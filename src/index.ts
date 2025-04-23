import { Context, Schema, h } from 'koishi'
import {} from "koishi-plugin-puppeteer";

export const name = 'anime-ccb'

export const inject = {
  required: ["puppeteer"],
};

export const usage = `
<h1>二刺螈猜猜呗</h1>

<p>数据来源于 <a href="https://bgm.tv/" target="_blank">bgm.tv</a></p>
`

export interface Config {}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    start_command: Schema.string().default("ccb").description("**游戏开始**的指令名称"),
    include_game: Schema.boolean().default(false).description("是否包含游戏作品   **仅自建题库生效**"),
    s_limit:Schema.number().default(10).description("关键词搜索的角色显示数量"),
    reminder: Schema.boolean().default(true).description("是否启用提示"),
  }).description('基础设置'),
  Schema.object({
    roles: Schema.union(['仅主角','全部角色']).required().description("角色范围设置"),
  }).description('角色范围设置'),
    Schema.union([
      Schema.object({
        roles: Schema.const('仅主角').required(),
        op_subtag: Schema.number().default(6).min(1).max(10).description("作品标签数"),
        op_chatag: Schema.number().default(6).min(1).max(10).description("角色标签数"),
      }),
      Schema.object({
        roles: Schema.const('全部角色').required(),
        persub_chanum: Schema.number().default(6).min(1).max(10).description("每个作品角色数"),
        all_subtag: Schema.number().default(6).min(1).max(10).description("作品标签数"),
        all_chatag: Schema.number().default(6).min(1).max(10).description("角色标签数"),
      }),
    ]),
  Schema.object({
    qtype: Schema.union(['使用自建题库','题库范围设置']).required().description("选择题库类型"),
  }).description('题库设置'),
    Schema.union([
      Schema.object({
        qtype: Schema.const('使用自建题库').required(),
        indexId: Schema.string().default("74077").description("题库id"),
      }),
      Schema.object({
        qtype: Schema.const('题库范围设置').required(),
        start_year: Schema.number().default(2015).min(1900).description("起始时间"),
        end_year: Schema.number().default(2025).description("截至时间"),
        form: Schema.union(['全部','TV','WEB','OVA','剧场版','动态漫画','其它']).default('全部').description("分类"),
        origin: Schema.union(['全部','原创','漫画改','游戏改','小说改']).default('全部').description("来源"),
        atype: Schema.union(['全部','科幻','喜剧','百合','校园','惊悚','后宫','机战','悬疑','恋爱','奇幻','推理','运动','耽美','音乐','战斗','冒险','萌系','穿越','玄幻','乙女','恐怖','历史','日常','剧情','武侠','美食','职场']).default('全部').description("类型"),
        rank: Schema.number().default(50).min(1).max(1000).description("bangumi热度排行榜排名(前xx部)"),
      }),
    ]),
]);

interface Gaming {
  [channelId: string]: boolean
}
interface Feedback {
  gender: { guess: any; feedback: string };
  popularity: { guess: number; feedback: string };
  rating: { guess: number; feedback: string };
  shared_appearances: { first: string; count: number };
  appearancesCount: { guess: number; feedback: string };
  metaTags: { guess: string[]; shared: string[] };
  latestAppearance: { guess: number | string; feedback: string };
  earliestAppearance: { guess: number | string; feedback: string };
}

// api授权
const accessToken = 'EP9NgEwLt2GgJWJSbFCDpqRNGCU0uVGCziFeEUMV';
    const userAgent = 'ranabot'
    const headers = {
      'User-Agent': userAgent,
      'Authorization': `Bearer ${accessToken}`
    };


// 基本逻辑
export function apply(ctx: Context, config) {
  let games: Gaming = {}
  ctx.command(config.start_command)
    .action(async ({session}) => {

      // 初始化并检测游戏状态
      if (games[session.channelId]) {
        return "当前已有正在进行的游戏"
      }
      games[session.channelId] = true;
      const sentMetaTags = new Set<any>(); // 定义一个存储已发送元标签的集合
      
      
      // 答题进程
      try {
        await session.send("加载中~");
        // 获取随机角色作为正确答案
        const characterAnswer = await getRandomCharacter(ctx, config);
        // const { id, nameCn, gender, image, summary, popularity } = characterAnswer.characterDetails;
        // const { appearances: validAppearances, latestAppearance, earliestAppearance, highestRating, metaTags } = characterAnswer.appearances;
        const answerDetails = characterAnswer.characterDetails; // 角色细节
        const answerAppearances = characterAnswer.appearances; // 角色出场信息
        const answerData = {
          ...answerAppearances,
          ...answerDetails
        }
        console.log("生成角色答案：", answerData);
        await session.send("加载成功，猜猜呗游戏开始~");

        // 搜索功能
        ctx.command('搜索 [...arg]')
        .action(async({session}, ...arg) => {
          let kw = '';
          kw += (arg === undefined) ? '' :arg.join('');
          if (kw == ''){
            await session.send("您输入的关键词为空");
          }else{
            const s_response = await searchCharacters(ctx, config, kw);
            if (s_response.data.length === 0){
              await session.send("未找到相关角色");
              return;
            }else{
              const message = s_response.data.map(character => `
                ID: ${character.id}
                名称: ${character.name}
              `.trim()).join('\n\n');
              await session.send(message);
            }
          }
        });
        


        const dispose = ctx.channel(session.channelId).middleware(async (session, next) => { // 使用中间键
          // 提示功能
          if (session.content === "提示" && config.reminder === true){
            const filteredMetaTags = answerAppearances.metaTags.filter(tag => tag !== config.atype && tag !== config.form); // 过滤掉用户自选类型
            const availableMetaTags = filteredMetaTags.filter(tag => !sentMetaTags.has(tag));// 过滤掉已发送的元标签
            if (availableMetaTags && availableMetaTags.length > 0) {
              const randomMetaTag = availableMetaTags[Math.floor(Math.random() * availableMetaTags.length)];
              await session.send(`提示：角色的一个元标签是 ${randomMetaTag}`);  
              sentMetaTags.add(randomMetaTag);// 将已发送的元标签添加到集合中
            }else{
              await session.send("所有元标签已发送完毕！");
            }
          };

          console.log("用户发送:", session.content);
          console.log("答案:", answerData.nameCn +''+ answerData.id);
          
          // 判断答案
          if (session.content === answerData.id){
            dispose();
            games[session.channelId] = false;
            await session.send("猜对了");
          }else if(session.content !== null && !isNaN(Number(session.content))){
            const user_ans = session.content;
            // 获取用户回答角色
            const ua_Details = await getCharacterDetails(user_ans,ctx);
            const ua_Appearances = await getCharacterApperance(user_ans,ctx,config);
            console.log("用户回答细节：", ua_Details.nameCn + ua_Appearances.metaTags);
            const ua_Data = {
              ...ua_Appearances,
              ...ua_Details
            }
            const result = await generateFeedback(ua_Data, answerData);
            console.log("结果：", result);
            const imageBuffer = await generateImg(ctx.puppeteer);
            await session.send(h.image(imageBuffer,"image/jpeg"));
          }
            
                         
        });
      } catch (error) {
        console.log("游戏进程错误：", error);
      }
      
      // const randomCharacter = await getRandomCharacter(ctx, config);
      // const { nameCn, gender, image, summary, popularity } = randomCharacter.characterDetails;
      // const { appearances: validAppearances, latestAppearance, earliestAppearance, highestRating, metaTags } = randomCharacter.appearances;
      // const imageBuffer = Buffer.from(image);// 将 ArrayBuffer 转换为 Buffer
      // // 格式化输出信息
      // const message = h('div', [
      //   h('img', { src: `data:image/jpeg;base64,${imageBuffer.toString('base64')}` }),
      //   h('p', `角色名称: ${nameCn || '未知'}`),
      //   h('p', `性别: ${gender}`),
      //   h('p', `简介: ${summary || '无简介'}`),
      //   h('p', `人气: ${popularity}`),
      //   h('p', `角色出场作品: ${validAppearances}`),
      //   h('p', `角色最晚出场年份: ${latestAppearance}`),
      //   h('p', `角色最早出场年份: ${earliestAppearance}`),
      //   h('p', `角色最高评分: ${highestRating}`),
      //   h('p', `元标签: ${metaTags}`),
      // ]);
      // await session.send(message);

    });
}

async function getSubjectDetails(subjectId: number, ctx: Context){// 获取作品信息
  try{
    // 请求api
    const url = `https://api.bgm.tv/v0/subjects/${subjectId}`;
    const response = await ctx.http.get(url, { headers });// 请求条目api【ctx.http.get返回的是promise，所以需要await等待解析完成】
    
    // 无返回处理
    if(!response){
      console.log('获取作品信息无数据返回')
    }else{
      // console.log('请求成功！json内容为：')
      // console.log(response)
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

async function searchCharacters(ctx:Context,config, s_word: string) {// 关键词搜索角色
  try {
    const response = await ctx.http.post(
      `https://api.bgm.tv/v0/search/characters?limit=${config.s_limit}`,
      {
        keyword: s_word
      }
    );
    console.log("用户搜索角色！");
    return response;
  }catch (error){
    console.log("搜索角色错误：", error);
  }
}

async function getCharacterApperance(characterId: string,ctx: Context, config) {// 获取角色出场信息
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
    // if (characterId === 56822 || characterId === 56823 || characterId === 17529 || characterId === 10956) {
    //   personsResponse.data = [];
    //   allMetaTags.add('展开');
    // } // 
    if (personsResponse.data && personsResponse.data.length) {
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

async function getCharacterDetails(characterId:string, ctx:Context) {// 获取角色详细信息
  try{
    // 请求api
    const url = `https://api.bgm.tv/v0/characters/${characterId}`;
    const response = await ctx.http.get(url, { headers });
    if (!response) {
      throw new Error('未获取角色信息');
    }
    // 获取简体中文名
    const nameCn = response.infobox?.find(item => item.key === '简体中文名')?.value || null;
    // 获取性别(只获取男性和女性)
    const gender = typeof response.gender === 'string' && 
      (response.gender === 'male' || response.gender === 'female') 
      ? response.gender 
      : '?';
    // 获取图片
    let imageArrayBuffer: ArrayBuffer;
    let imageUrl:string;
    imageUrl = response.images.medium;
    imageArrayBuffer = await ctx.http.get(imageUrl, {responseType:"arraybuffer"});
    // 返回数据
    return {
      nameCn: nameCn,
      gender,
      image: imageArrayBuffer,
      summary: response.summary,
      popularity: response.stat.collects,
      id: characterId
    };
  }catch (error){
    console.log("获取角色信息错误：",error);
    throw error;
  }
}

async function getCharactersBySubjectId(subjectId:number, ctx:Context) {// 根据作品id获取角色（仅获取主角+配角）
  try {
    // 请求api
    const response = await ctx.http.get(`https://api.bgm.tv/v0/subjects/${subjectId}/characters`);
    if (!response || !response.length) {
      throw new Error('此作品未找到角色信息');
    }
    // 过滤主角配角
    const filteredCharacters = response.filter(character => 
      character.relation === '主角' || character.relation === '配角'
    );
    if (filteredCharacters.length === 0) {
      throw new Error('此作品未找到主配角');
    }
    // 返回数据
    return filteredCharacters;
  } catch (error) {
    console.error('从作品获取角色错误:', error);
    throw error;
  }
}

async function getIndexInfo(indexId, ctx:Context) {// 根据索引(目录)寻找作品
  try {
    const response = await ctx.http.get(`https://api.bgm.tv/v0/indices/${indexId}`);
    if (!response) {
      throw new Error('找不到索引信息');
    }
    // 返回数据
    return {
      title: response.title,
      total: response.total
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('未找到此索引');
    }
    console.error('根据索引寻找作品错误:', error);
    throw error;
  }
}

async function searchSubjects(keyword, ctx:Context) {// 根据关键词搜索作品
  try {
    // 请求api
    const response = await ctx.http.post(`https://api.bgm.tv/v0/search/subjects`, {
      keyword: keyword.trim(),
      filter: {
        // type: [2]  // 单动画
        type: [2, 4]  // 动画与游戏
      }
    });
    if (!response || !response.data) {
      return [];
    }
    
    // 返回结果
    return response.data.map(subject => ({
      id: subject.id,
      name: subject.name,
      name_cn: subject.name_cn,
      image: subject.images?.grid || subject.images?.medium || '',
      date: subject.date,
      type: subject.type==2 ? '动漫' : '游戏'
    }));
    
  } catch (error) {
    console.error('关键词搜索作品错误:', error);
    return [];
  }
}

async function getRandomCharacter(ctx:Context, config) {// 根据用户设置随机获取角色（答案）
  try {
    // 初始变量
    let subject;
    let randomOffset;
    let filteredCharacters: any[];

    // 自建题库模式
    if (config.qtype === '使用自建题库' && config.indexId){
      const indexInfo = await getIndexInfo(config.indexId, ctx);// 获取目录信息
      randomOffset = Math.floor(Math.random() * indexInfo.total);// 生成随机偏移量
      //请求api从题库选择一个作品
      const indexResponse = await ctx.http.get(`https://api.bgm.tv/v0/indices/${config.indexId}/subjects?limit=1&offset=${randomOffset}`)//从索引选择一个作品
      if (!indexResponse) {
        console.log('此目录未找到作品！')
      }
      subject = indexResponse;
    }else{
    // 设置范围模式
      const mtag_filter = Array.isArray(config.atype) ? config.qtype : [config.atype];// 获取类型标签
      randomOffset = Math.floor(Math.random() * config.rank);// 生成随机偏移量
      const endDate = new Date(`${config.end_year + 1}-01-01`);
      const today = new Date();
      const minDate = new Date(Math.min(endDate.getTime(), today.getTime())).toISOString().split('T')[0];
      // 请求api，过滤作品类型
      const response = await ctx.http.post(`https://api.bgm.tv/v0/search/subjects?limit=1&offset=${randomOffset}`,{
        "sort": "heat",
        "filter":{
          "type": [2],
          "air_date": [`>=${config.start_year}-01-01`,
          `<${minDate}`],
          "meta_tags": mtag_filter.filter(tag => tag !== "")// 根据过滤条件获取
        }
      });
      if (!response) {
        console.log('设置范围模式随机获取角色失败');
      }
      subject = response;
      }

      // 获取作品中的角色
      console.log("获取的作品subjectId为：",subject.data[0].id);
      const characters = await getCharactersBySubjectId(subject.data[0].id,ctx);
      // 过滤主配角
      if (config.roles === '仅主角'){
        filteredCharacters = characters.filter(character => character.relation === '主角').slice(0, config.op_chatag);
      }else{
        filteredCharacters = characters.filter(character => character.relation === '主角' || character.relation === '配角').slice(0, config.all_chatag);
      }
      if (filteredCharacters.length === 0) {
        console.log('此作品中未找到角色');
      }
      // 随机选择角色
      const selectedCharacter = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];
      console.log("获取的随机角色id为：",selectedCharacter.id);
      // 获取角色额外细节
      const characterDetails = await getCharacterDetails(selectedCharacter.id,ctx);
      // 获取角色出场信息
      const appearances = await getCharacterApperance(selectedCharacter.id, ctx, config);
      // 返回数据
      return {
        selectedCharacter,
        characterDetails,
        appearances
      };
  } catch (error) {
    console.log("获取随机角色错误：", error);
  }
}

async function generateFeedback(guess, answerCharacter) {// 根据用户答案和正确答案计算反馈
  try {
    const result: Feedback = {
      gender: { guess: guess.gender, feedback: '' },
      popularity: { guess: guess.popularity, feedback: '' },
      rating: { guess: guess.highestRating, feedback: '' },
      shared_appearances: { first: '', count: 0 },
      appearancesCount: { guess: guess.appearances.length, feedback: '' },
      metaTags: { guess: guess.metaTags, shared: [] },
      latestAppearance: { guess: guess.latestAppearance === -1 ? '?' : guess.latestAppearance, feedback: '' },
      earliestAppearance: { guess: guess.earliestAppearance === -1 ? '?' : guess.earliestAppearance, feedback: '' }
    };
    
    // 性别比较
    result.gender = {
      guess: guess.gender,
      feedback: guess.gender === answerCharacter.gender ? 'yes' : 'no'
    };
    // 计算人气差距
    const popularityDiff = guess.popularity - answerCharacter.popularity;
    const fivePercent = answerCharacter.popularity * 0.05;
    const twentyPercent = answerCharacter.popularity * 0.2;
    let popularityFeedback;
    if (Math.abs(popularityDiff) <= fivePercent) {
      popularityFeedback = '=';
    } else if (popularityDiff > 0) {
      popularityFeedback = popularityDiff <= twentyPercent ? '+' : '++';
    } else {
      popularityFeedback = popularityDiff >= -twentyPercent ? '-' : '--';
    }
    result.popularity = {
      guess: guess.popularity,
      feedback: popularityFeedback
    };
    // 评分差距
    const ratingDiff = guess.highestRating - answerCharacter.highestRating;
    let ratingFeedback;
    if (guess.highestRating === -1 || answerCharacter.highestRating === -1) {
      ratingFeedback = '?';
    } else if (Math.abs(ratingDiff) <= 0.2) {
      ratingFeedback = '=';
    } else if (ratingDiff > 0) {
      ratingFeedback = ratingDiff <= 0.5 ? '+' : '++';
    } else {
      ratingFeedback = ratingDiff >= -0.5 ? '-' : '--';
    }
    result.rating = {
      guess: guess.highestRating,
      feedback: ratingFeedback
    };
    // 出场作品差距
    const sharedAppearances = guess.appearances.filter(appearance => answerCharacter.appearances.includes(appearance));
    result.shared_appearances = {
      first: sharedAppearances[0] || '',
      count: sharedAppearances.length
    };
    // 出场作品数量差距
    const appearanceDiff = guess.appearances.length - answerCharacter.appearances.length;
    let appearancesFeedback;
    if (appearanceDiff === 0) {
      appearancesFeedback = '=';
    } else if (appearanceDiff > 0) {
      appearancesFeedback = appearanceDiff <= 2 ? '+' : '++';
    } else {
      appearancesFeedback = appearanceDiff >= -2 ? '-' : '--';
    }
    result.appearancesCount = {
      guess: guess.appearances.length,
      feedback: appearancesFeedback
    };
    // 元标签差距
    const answerMetaTagsSet = new Set(answerCharacter.metaTags);
    const sharedMetaTags = guess.metaTags.filter(tag => answerMetaTagsSet.has(tag));
    result.metaTags = {
      guess: guess.metaTags,
      shared: sharedMetaTags
    };
    // 最新出场差距
    if (guess.latestAppearance === -1 || answerCharacter.latestAppearance === -1) {
      result.latestAppearance = {
        guess: guess.latestAppearance === -1 ? '?' : guess.latestAppearance,
        feedback: guess.latestAppearance === -1 && answerCharacter.latestAppearance === -1 ? '=' : '?'
      };
    } else {
      const yearDiff = guess.latestAppearance - answerCharacter.latestAppearance;
      let yearFeedback;
      if (yearDiff === 0) {
        yearFeedback = '=';
      } else if (yearDiff > 0) {
        yearFeedback = yearDiff <= 2 ? '+' : '++';
      } else {
        yearFeedback = yearDiff >= -2 ? '-' : '--';
      }
      result.latestAppearance = {
        guess: guess.latestAppearance,
        feedback: yearFeedback
      };
    }
    // 最早出场差距
    if (guess.earliestAppearance === -1 || answerCharacter.earliestAppearance === -1) {
      result.earliestAppearance = {
        guess: guess.earliestAppearance === -1 ? '?' : guess.earliestAppearance,
        feedback: guess.earliestAppearance === -1 && answerCharacter.earliestAppearance === -1 ? '=' : '?'
      };
    } else {
      const yearDiff = guess.earliestAppearance - answerCharacter.earliestAppearance;
      let yearFeedback;
      if (yearDiff === 0) {
        yearFeedback = '=';
      } else if (yearDiff > 0) {
        yearFeedback = yearDiff <= 2 ? '+' : '++';
      } else {
        yearFeedback = yearDiff >= -2 ? '-' : '--';
      }
      result.earliestAppearance = {
        guess: guess.earliestAppearance,
        feedback: yearFeedback
      };
    }
    return result;
  } catch (error) {
    console.log("获取结果反馈错误：", error);
  }
}

async function generateImg(pptr) {// 渲染图片
  try {
    const page = await pptr.browser.newPage();
    // const textcolor = `rgb(255,255,255)`;
    // const backgroundcolor = `rgb(0,0,0)`;
    await page.setContent(testHTML);
    const screenshot = await page.screenshot({encoding:'binary'});
    await page.close();
    return screenshot;
  } catch (error) {
    console.log("渲染图片出错：", error);
  }
}

const testHTML = `
<html style={"color: purple;"}>
  <h1>This is a header</h1>
  <p>Hello Puppeteer!</p>
</html>
`;


