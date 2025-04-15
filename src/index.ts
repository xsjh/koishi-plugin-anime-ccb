import { Context, Schema, h, Random } from 'koishi'
import fs from "node:fs";
import path from "node:path";

export const name = 'anime-ccb'

export const usage = `
<h1>二刺螈猜猜呗</h1>

<p>数据来源于 <a href="https://bgm.tv/" target="_blank">bgm.tv</a></p>
`

export interface Config {}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    start_command: Schema.string().default("ccb").description("`游戏开始`的指令名称"),
    include_game: Schema.boolean().default(false).description("是否包含游戏作品"),
  }).description('游戏设置'),
]);

interface Gaming {
  [channelId: string]: boolean
}

// api授权
const accessToken = 'EP9NgEwLt2GgJWJSbFCDpqRNGCU0uVGCziFeEUMV';
    const userAgent = 'ranabot'
    const headers = {
      'User-Agent': userAgent,
      'Authorization': `Bearer ${accessToken}`
    };



export function apply(ctx: Context, config) {
  let games: Gaming = {}
  ctx.command(config.start_command)
    .action(async ({session}) => {
      // 检测游戏状态
      if (games[session.channelId]) {
        return "当前已有正在进行的游戏"
      }
      games[session.channelId] = true
      
      // 作品信息获取
      const subjectDetails = await getSubjectDetails(428735, ctx);
      const { name, year, meta_tags, tags, rating, rating_count } = subjectDetails;
        const message = `
          作品名称: ${name}
          年份: ${year || '未知'}
          元标签: ${meta_tags.join(', ')}
          标签: ${tags.join(', ')}
          评分: ${rating}
          评分人数: ${rating_count}
        `.trim();
        await session.send(message);

      //角色作品配音获取
      const CharacterApperance = await getCharacterApperance(17763, ctx, config);
      const { appearances: validAppearances, latestAppearance, earliestAppearance, highestRating, metaTags } = CharacterApperance;
        const message1 = `
          角色出场作品: ${validAppearances}
          角色最晚出场年份: ${latestAppearance}
          角色最早出场年份: ${earliestAppearance}
          角色最高评分: ${highestRating}
          元标签: ${metaTags}
        `.trim();
        await session.send(message1);
      
      

    });
}

async function getSubjectDetails(subjectId: number, ctx: Context){
  try{
    // 请求api
    const url = `https://api.bgm.tv/v0/subjects/${subjectId}`;
    const response = await ctx.http.get(url, { headers });// 请求条目api【ctx.http.get返回的是promise，所以需要await等待解析完成】
    
    // 无返回处理
    if(!response){
      console.log('获取作品信息无数据返回')
    }else{
      console.log('请求成功！json内容为：')
      console.log(response)
    }
    
    // 播出时间处理
    const airDate = response.date;
    const currentDate = new Date();
    if (airDate && new Date(airDate) > currentDate) {
      return null;// 未播出则返回null 
    }
    let year = airDate ? parseInt(airDate.split('-')[0]) : null;// 已播出则提取年份

    // 提取标签tag
    const tags = new Set();
    if (response.type === 2) {
      response.tags.slice(0, 10).forEach(tag => tags.add(tag.name));
    }
    if (response.type === 4) {
      response.tags.slice(0, 5).forEach(tag => tags.add(tag.name));
    }
    
    // 返回请求到的数据
    return {
      name: response.name_cn || response.name, // 优先使用中文名
      year, // 年份
      meta_tags: response.meta_tags, // 原始的元标签（未处理）
      tags: Array.from(tags), // 处理后的标签数组
      rating: response.rating?.score || 0, // 评分，如果没有则为 0
      rating_count: response.rating?.total || 0 // 评分人数，如果没有则为 0
    };
  }catch (error){
    console.error('获取作品信息错误：',error);
  }
}

async function getCharacterApperance(characterId: number,ctx: Context, config) {
  try{
    // 请求角色的出场作品和配音演员信息
    const [subjectsResponse, personsResponse] = await Promise.all([
      ctx.http.get(`https://api.bgm.tv/v0/characters/${characterId}/subjects`),
      ctx.http.get(`https://api.bgm.tv/v0/characters/${characterId}/persons`)
    ]);
    // 检查作品数据是否有效
    if (!subjectsResponse || !subjectsResponse.length) {
      return {
        appearances: [],
        latestAppearance: -1,
        earliestAppearance: -1,
        highestRating: 0,
        metaTags: []
      };
    }
    // 根据设置决定是否包含游戏
    let filteredAppearances;
    if (config.include_game) {
      filteredAppearances = subjectsResponse.filter(appearance => 
        (appearance.staff === '主角' || appearance.staff === '配角')
        && (appearance.type === 2 || appearance.type === 4));
    } else {
      filteredAppearances = subjectsResponse.filter(appearance => 
        (appearance.staff === '主角' || appearance.staff === '配角')
        && (appearance.type === 2));
    }// 同样检查过滤后作品是否有效
    if (filteredAppearances.length === 0) {
      return {
        appearances: [],
        latestAppearance: -1,
        earliestAppearance: -1,
        highestRating: -1,
        metaTags: []
      };
    }

    // 定义变量
    let latestAppearance = -1;// 最晚出场年份
    let earliestAppearance = -1;// 最早出场年份
    let highestRating = -1;// 角色最高评分
    let highestRatingCount = -1;// 评分人数
    let highestRatingCountTags = [];// 元标签
    const allMetaTags = new Set();
    //获取每个出场作品的详细信息
    const appearances = await Promise.all(// promise.all并行执行异步函数，减少请求时间
      filteredAppearances.map(async appearance => {// map方式遍历filteredAppearances
        try {
          const details = await getSubjectDetails(appearance.id,ctx);
          if (!details || details.year === null) return null;// 未播出的跳过

          // 作品类型过滤器留置位（方便用户选择题目作品类型范围）
          // if (!gameSettings.metaTags.filter(tag => tag !== '').every(tag => details.meta_tags.includes(tag))){
          //   return null;
          // }
          
          // 更新最早和最晚出场年份
          if (latestAppearance === -1 || details.year > latestAppearance) {
            latestAppearance = details.year;
          }
          if (earliestAppearance === -1 || details.year < earliestAppearance) {
            earliestAppearance = details.year;
          }
          // 更新最高评分
          if (details.rating > highestRating) {
            highestRating = details.rating;
          }
          // 更新元标签(具有最高评分人数)
          if (details.rating_count > highestRatingCount) {
            highestRatingCount = details.rating_count;
            highestRatingCountTags = details.tags;
          }
          details.meta_tags.forEach(tag => allMetaTags.add(tag));
          // 返回作品信息
          return {
            name: details.name,
            rating_count: details.rating_count
          };
        } catch (error) {
          console.error(`获取角色出场作品信息失败 ${appearance.id}:`, error);
          return null;
        }
      })
    );
    // 将评分最高的作品的标签添加到元标签集合中
    highestRatingCountTags.forEach(tag => allMetaTags.add(tag));
    // 过滤、排序并提取出场作品的名称
    const validAppearances = appearances
      .filter(appearance => appearance !== null) // 去除不符合条件的作品
      .sort((a, b) => b.rating_count - a.rating_count)// 根据评分人数降序排列
      .map(appearance => appearance.name);// map方法遍历提取每个作品名称
    // 特殊角色处理
    if (characterId === 56822 || characterId === 56823 || characterId === 17529 || characterId === 10956) {
      personsResponse.data = [];
      allMetaTags.add('展开');
    } // 
    else if (personsResponse.data && personsResponse.data.length) {
      const animeVAs = personsResponse.data.filter(person => person.subject_type === 2 || person.subject_type === 4);
      if (animeVAs.length > 0) {
        animeVAs.forEach(person => {
          allMetaTags.add(`${person.name}`);
        });
      }
    }
    // 返回数据
    return {
      appearances: validAppearances, // 过滤后的角色出场作品
      latestAppearance, // 角色最晚出场年份
      earliestAppearance, // 角色最早出场年份
      highestRating, // 角色最高评分
      metaTags: Array.from(allMetaTags) // 角色元标签
    };
  }catch (error){
    console.log("请求角色的出场作品和配音演员信息错误：",error)
  }
  

  
}
