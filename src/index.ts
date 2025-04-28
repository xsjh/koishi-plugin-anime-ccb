import {} from '@koishijs/plugin-help'
import { Context, Schema, h, Logger } from 'koishi'
import {} from "koishi-plugin-puppeteer";

export const name = 'anime-ccb'

export const logger = new Logger('ccb');

export const inject = {
  required: ["puppeteer"],
};

export const usage = `
<h1>二刺猿猜猜呗</h1>
<p>角色数据来源于 <a href="https://bgm.tv/" target="_blank">bgm.tv</a></p>
<p>灵感来源于 <a href="https://anime-character-guessr.netlify.app/" target="_blank">anime-character-guessr</a></p>
<hr>
<h2>Tutorials</h2>
<h3> ⭐️开启游戏前请先检查token设置，根据指引生成自己的accesstoken⭐️</h3>
<h4>指令介绍：</h4>
<p>输入指令即可开始游戏，加载完成后:</p>
<ul>
<p> · 输入<code>搜角色 角色关键词</code>即可查询角色（例：搜索 千早爱音）</p>
<p> · 输入<code>搜作品 作品关键词</code>即可查询作品id（例：搜索 间谍过家家）</p>
<p> · 输入<code>作品搜角色 作品ID</code>即可查询对应作品的出场角色id（例：搜索 间谍过家家）</p>
</ul>
<p><b>发送查询到的角色的ID，即可进行答题</b></p>
<ul>
<p> · 若开启了提示功能，发送<code>提示</code>即可得知答案角色的随机一个标签</p>
<p> · 箭头↑代表答案数值要更大，箭头↓代表答案数值要更小 | 双箭头表示差距更大</p>
<p> · 输入<code>bzd</code>即可结束本次游戏，并获得答案</p>
</ul>
<h3>如何创建自建题库？</h3>
<ul>
<p>请点击👉<b><u><a href="https://anime-character-guessr.netlify.app/" target="_blank">Bangumi目录网址</a></u></b></p>
<p> · 创建后点击进入目录，看见网址https://bangumi.tv/index/xxxxx</p>
<p> · 将数字：xxxxx填入indexId即可使用此题库</p>
</ul>
<hr>
<h3>Notice</h3>
<p>游玩中若遇到什么问题，或是一些其余反馈，请移步至👉<b><a href="https://forum.koishi.xyz/t/topic/10889" target="_blank">论坛10889帖</a>进行反馈</b></p>
<p>⚠️由于bangumi游戏作品排名问题，仅自建题库包含游戏选项，并且此功能未经测试，请谨慎开启⚠️</p>
<p>Onebot 适配器下，偶尔发不出来图，Koishi 报错日志为 <code>retcode:1200</code> 时，请查看协议端日志自行解决！</p>
<p>QQ 适配器下，偶尔发不出来图，Koishi 报错日志为 <code>bad request</code> 时，建议参见 👉<b><a href="https://forum.koishi.xyz/t/topic/10257" target="_blank">论坛10257帖</b></a>
<hr>
<div class="version">
<h3>Version</h3>
<p>1.0.8</p>
<ul>
<li>修复了年份显示bug</li>
<li>增加搜作品与根据作品搜角色指令</li>
<li>完成反馈卡片渲染</li>
<li>取消了开启提示功能情况下开局自动发送标签功能，并优化提示功能的标签发送</li>
<li>优化了开局规则讲解</li>
<li>现在面对初始化失败时能正确的抛出错误并返回</li>
</ul>
</div>
<hr>
<div class="thanks">
<h3>Thanks</h3>
<p>部分图片UI参考： <a href="/market?keyword=koishi-plugin-bilibili-notify">koishi-plugin-bilibili-notify</a></p>
<p>感谢风切的宝贵意见</p>
<hr>
<h4>如果想继续开发优化本插件，<a href="https://github.com/xsjh/koishi-plugin-anime-ccb/pulls" target="_blank">欢迎 PR</a></h4>
</body>
`

export interface Config {}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    accessToken: Schema.string().default("EP9NgEwLt2GgJWJSbFCDpqRNGCU0uVGCziFeEUMV").description("点击此链接生成： https://next.bgm.tv/demo/access-token <br>[ 默认的是作者自己的,可能会失效 ]"),
    userAgent: Schema.string().default("ranabot").description("生成token时输入的名称"),
  }).description('token设置'),

  Schema.object({
    start_command: Schema.string().default("ccb").description("**游戏开始**的指令名称"),
    include_game: Schema.boolean().default(false).description("是否包含游戏作品   **仅自建题库生效**").experimental(),
    s_limit: Schema.number().default(10).min(5).max(20).description("关键词搜索的角色显示数量"),
    a_limit: Schema.number().default(10).min(5).max(20).description("答题次数限制"),
    reminder: Schema.boolean().default(true).description("是否启用提示"),
  }).description('基础设置'),

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

  Schema.object({
    roles: Schema.union(['仅主角','全部角色']).required().description("角色范围设置"),
  }).description('答案范围设置'),
    Schema.union([
      Schema.object({
        roles: Schema.const('仅主角').required(),
        // op_subtag: Schema.number().default(6).min(1).max(10).description("从题库中抽选的作品数量"),
        op_chatag: Schema.number().default(6).min(1).max(20).description("从每个作品中抽选的角色数量"),
      }),
      Schema.object({
        roles: Schema.const('全部角色').required(),
        persub_chanum: Schema.number().default(6).min(1).max(20).description("从每个作品中抽选的角色数量"),
      }),
    ]),

  Schema.object({
    outputLogs: Schema.boolean().default(false).description('日志调试模式，如有报错可开启进行排查').experimental(),
  }).description('调试设置'),
]);

// 游戏进程检测
interface Gaming {
  [channelId: string]: boolean
}
// 比对反馈数据接口
interface Feedback {
  gender: { guess: any; feedback: string };
  popularity: { guess: any; feedback: string };
  rating: { guess: any; feedback: string };
  shared_appearances: { first: string[]; count: number };
  appearancesCount: { guess: any; feedback: string };
  metaTags: { guess: string[]; shared: string[] };
  latestAppearance: { guess: number | string; feedback: string };
  earliestAppearance: { guess: number | string; feedback: string };
}
// 用户回答角色数据接口
interface Character {
  imgurl: string;
  name: string;
  gender: string;
  popularity: string;
  workscount: string;
  highestRating: string;
  earliestAppearance: number | string;
  latestAppearance: number | string;
  tags: string[];
  shared_appearances: string[];
}
// 用户搜索返回数据
interface sCharacter {
  imgurl: string;
  name: string;
  jname: string;
  id: string;
}
// api授权
let headers: Record<string, string>;
export function getHeaders(ctx: Context, config) {
  // api授权
  const accessToken = `${config.accessToken}`;
  const userAgent = `${config.userAgent}`;
  headers = {
    'User-Agent': userAgent,
    'Authorization': `Bearer ${accessToken}`
  };
}



// 基本逻辑
export function apply(ctx: Context, config) {
  let games: Gaming = {};
  

  ctx.command(config.start_command, '二次猿猜猜呗')
    .action(async ({session}) => {

      // 初始化
      if (games[session.channelId]) {
        return "当前已有正在进行的游戏"
      }
      games[session.channelId] = true;
      const sentMetaTags = new Set<any>(); // 存储已发送元标签的集合
      let pre_sharedTags = [];  // 存储上次回答命中的标签的集合
      const characters:Character[]=[]; // 存储用户回答的角色
      const userAnsHistory: string[] = [];// 存储用户回答历史
       

      // 答题进程
      try {
        await session.send("加载中~");
        // 获取随机角色作为正确答案
        const characterAnswer = await getRandomCharacter(ctx, config);
        const answerDetails = characterAnswer.characterDetails; // 角色细节
        const answerAppearances = characterAnswer.appearances; // 角色出场信息
        const answerData = {
          ...answerAppearances,
          ...answerDetails
        }
        // 发送开始提示
        if (config.qtype === '使用自建题库'){
          await session.send(`加载成功！猜猜呗游戏开始~\n · 输入[搜角色 角色关键词]即可查询角色id\n · 输入[搜作品 作品关键词]即可查询作品id\n · 输入[作品搜角色 作品id]即可查询对应作品的出场角色id\n · 发送查询到的角色的id，即可进行答题\n · 输入 bzd 即可结束本次游戏\n本次题库范围：自建题库 - ${config.roles}`);
        }else{
          await session.send(`加载成功！猜猜呗游戏开始~\n · 输入[搜角色 角色关键词]即可查询角色id\n · 输入[搜作品 作品关键词]即可查询作品id\n · 输入[作品搜角色 作品id]即可查询对应作品的出场角色id\n · 发送查询到的角色的id，即可进行答题\n · 输入 bzd 即可结束本次游戏\n本次题库范围：\n · 门类：${config.form} · ${config.atype} · ${config.origin}\n · 人物范围：${config.roles}\n · 时间范围：${config.start_year} - ${config.end_year}\n · Bangumi热度榜前${config.rank}名`);
        }
        
        

        if (config.outputLogs === true){
          logger.info('游戏启动成功，答案为：', answerData.id, answerData.nameCn);
        }

        // 角色检索命令
        ctx.command('搜角色 [...arg]')
        .action(async({session}, ...arg) => {
          try {
            const kw = arg.join(' ').trim();
          if (kw == ''){
            await session.send("您输入的关键词为空");
          }else{
            const s_response = await searchCharacters(ctx, config, kw);
            if (s_response.data.length === 0){
              await session.send("未找到相关角色");
              return;
            }else{// 发送检索结果
              const result: sCharacter [] =[];
              s_response.data.forEach(character => {
                const s_character: sCharacter = {
                  id: character.id.toString(),
                  jname: character.name,
                  imgurl: character.images?.grid || [],
                  name: character.infobox?.find(item => item.key === '简体中文名')?.value || '无中文名'
                };
                result.push(s_character); 
              });
              const imageBuffer = await generateSearchImg(ctx.puppeteer, result, config);
              await session.send(h.image(imageBuffer,"image/jpeg"));
            }
          }
          } catch (error) {
            if (config.outputLogs === true){
              logger.error('检索角色出现问题：', error);
            }
          }
        });
        // 根据作品检索角色命令
        ctx.command('作品搜角色 [...arg]')
        .action(async({session}, ...arg) => {
          try {
            // 将用户输入的字符串转换为数字
            const s_id = Number(arg.join(' ').trim());
            // 检查是否为空或无效数字
            if (isNaN(s_id) || s_id === 0) {
              await session.send("您输入的作品id无效，请输入一个有效的数字");
              return;
            }
            let filteredres: any[];
            const sc_response = await getCharactersBySubjectId(s_id, ctx);
            // 过滤主配角
            if (config.roles === '仅主角'){
              filteredres = sc_response.filter(character => character.relation === '主角').slice(0, config.op_chatag);
            }else{
              filteredres = sc_response.filter(character => character.relation === '主角' || character.relation === '配角').slice(0, config.persub_chanum);
            }
            console.log('作品返回角色：',filteredres);
            if (filteredres.length === 0){
              await session.send("未找到相关角色");
              return;
            }else{// 发送检索结果
              const result: sCharacter [] =[];
              for (const character of filteredres) {// 改用for of方法处理异步函数
                const getNameCn = await getCharacterDetails(character.id, ctx, config);
                const sc_character: sCharacter = {
                  id: character.id.toString(),
                  jname: character.name,
                  imgurl: character.images?.grid || [],
                  name: getNameCn.nameCn || '无中文名'
                };
                console.log('中文名：', getNameCn.nameCn);
                result.push(sc_character);
              }
              console.log('result', result);
              const sc_imageBuffer = await generateSearchImg(ctx.puppeteer, result, config);
              await session.send(h.image(sc_imageBuffer,"image/jpeg"));
            }
          } catch (error) {
            if (config.outputLogs === true){
              logger.error('根据作品检索角色出现问题，请检查作品id是否输入正确：', error);
            }
          }
        });
        // 检索作品命令
        ctx.command('搜作品 [...arg]')
        .action(async({session}, ...arg) => {
          try {
            const kw = arg.join(' ').trim();
          if (kw == ''){
            await session.send("您输入的关键词为空");
          }else{
            const ss_res = await searchSubjects(kw, ctx, config);
            if (ss_res.length === 0){
              await session.send("未找到相关作品");
              return;
            }else{// 发送检索结果
              const result: sCharacter [] =[];
              ss_res.forEach(subject => {
                const s_subject: sCharacter = {
                  id: subject.id.toString(),
                  jname: subject.name,
                  imgurl: subject.image,
                  name: subject.name_cn || '无中文名'
                };
                result.push(s_subject); 
              });
              const ss_imageBuffer = await generateSearchImg(ctx.puppeteer, result, config);
              await session.send(h.image(ss_imageBuffer,"image/jpeg"));
            }
          }
          } catch (error) {
            if (config.outputLogs === true){
              logger.error('检索角色出现问题：', error);
            }
          }
        });
        

        // 启动监听
        const dispose = ctx.channel(session.channelId).middleware(async (session, next) => { // 使用中间键
          
          // 1、提示功能
          if (session.content === "提示" && config.reminder === true){
            const excludedTags = [// 需要排除的标签
              config.atype,
              config.form,
              ...answerData.appearances,
              answerData.jname,
              answerData.nameCn,
              ...pre_sharedTags
            ];
            const filteredMetaTags = answerAppearances.metaTags.filter(tag => !excludedTags.includes(tag)); // 过滤掉用户自选类型
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
          // console.log("答案:", answerData.metaTags);

          // 提前处理结果卡片渲染需要的数据
          const summary = answerData.summary;
            let handled_sum = null;
            if (summary.length > 200) {// 处理简介
              handled_sum = summary.substring(0, 200) + '...';
            }else{
              handled_sum = summary;
            }
            const card_info = {
              bigImgurl: answerData.BimageUrl,
              name: answerData.nameCn,
              imgurl: answerData.imageUrl,
              id: answerData.id,
              summary: handled_sum,
              popularity: answerData.popularity,
              work: answerData.appearances[0]
            };

          // 2、判断答案
          if (session.content === `${answerData.id}` || session.content === `${answerData.nameCn}`){
            dispose();
            games[session.channelId] = false;
            // 发送答案正确卡片
            const imageBuffer = await generateResultImg(ctx.puppeteer, card_info, config, '正确');
            await session.send(h.image(imageBuffer,"image/jpeg"));
          }else if(session.content === "bzd"){
            dispose();
            games[session.channelId] = false;
            // 发送答案错误卡片
            const imageBuffer = await generateResultImg(ctx.puppeteer, card_info, config, '错误');
            await session.send(h.image(imageBuffer,"image/jpeg"));
          }else if(session.content !== null && !isNaN(Number(session.content))){
            const user_ans = session.content;
            if (userAnsHistory.includes(user_ans)) {// 检查用户输入的角色是否已经存在表格中
              await session.send("此角色已在表格中~");
              return;
            } else {
              userAnsHistory.push(user_ans);
              // 获取用户回答角色
            const ua_Details = await getCharacterDetails(user_ans, ctx, config);
            const ua_Appearances = await getCharacterApperance(user_ans,ctx,config);
            console.log("用户回答细节：", ua_Details.nameCn + ua_Appearances.metaTags);
            const ua_Data = {
              ...ua_Appearances,
              ...ua_Details
            }
            const result = await generateFeedback(ua_Data, answerData);
            const an_character:Character = {// 处理卡片渲染需要的数据
              imgurl: ua_Data.imageUrl,
              name: ua_Data.nameCn,
              gender: result.gender.guess,
              popularity: result.popularity.guess,
              workscount: result.appearancesCount.guess,
              highestRating: result.rating.guess,
              earliestAppearance: result.earliestAppearance.guess,
              latestAppearance: result.latestAppearance.guess,
              tags: result.metaTags.shared,
              shared_appearances: result.shared_appearances.first
            }
            // 根据 feedback 调整
            an_character.gender += result.gender.feedback === 'yes' ? ' √' : result.gender.feedback === 'no' ? ' ×' : '';
            an_character.popularity += result.popularity.feedback === '+' ? '↓' : result.popularity.feedback === '++' ? ' ↓↓' : result.popularity.feedback === '-' ? ' ↑' : result.popularity.feedback === '--' ? ' ↑↑' : '';
            an_character.workscount += result.appearancesCount.feedback === '+' ? '↓' : result.appearancesCount.feedback === '++' ? ' ↓↓' : result.appearancesCount.feedback === '-' ? ' ↑' : result.appearancesCount.feedback === '--' ? ' ↑↑' : '';
            an_character.highestRating += result.rating.feedback === '+' ? '↓' : result.rating.feedback === '++' ? ' ↓↓' : result.rating.feedback === '-' ? ' ↑' : result.rating.feedback === '--' ? ' ↑↑' : '';
            an_character.earliestAppearance += result.earliestAppearance.feedback === '+' ? '↓' : result.earliestAppearance.feedback === '++' ? ' ↓↓' : result.earliestAppearance.feedback === '-' ? ' ↑' : result.earliestAppearance.feedback === '--' ? ' ↑↑' : '';
            an_character.latestAppearance += result.latestAppearance.feedback === '+' ? '↓' : result.latestAppearance.feedback === '++' ? ' ↓↓' : result.latestAppearance.feedback === '-' ? ' ↑' : result.latestAppearance.feedback === '--' ? ' ↑↑' : '';            
            characters.push(an_character);
            const imageBuffer = await generateImg(ctx.puppeteer, characters, config);
            await session.send(h.image(imageBuffer,"image/jpeg"));
            } 
            if (userAnsHistory.length > config.a_limit - 1){
              dispose();
              games[session.channelId] = false;
              // 发送次数过多卡片
              const imageBuffer = await generateResultImg(ctx.puppeteer, card_info, config, '次数');
              await session.send(h.image(imageBuffer,"image/jpeg"));
              return;
            }
          }else{
            return next();
          }
        },true);
      } catch (error) {
        logger.error("ccb游戏进程错误：", error);
        games[session.channelId] = false;
        await session.send('游戏初始化失败，请重新开始，或是酌情调整题库范围');
        return;
      }
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

async function getCharacterDetails(characterId:string, ctx:Context, config) {// 获取角色详细信息
  try{
    // 请求api
    const url = `https://api.bgm.tv/v0/characters/${characterId}`;
    const response = await ctx.http.get(url, { headers });
    if (!response) {
      throw new Error('未获取角色信息');
    }
    // 获取简体中文名
    const nameCn = response.infobox?.find(item => item.key === '简体中文名')?.value || null;
    // 获取日文名
    const jname = response.name;
    // 获取性别(只获取男性和女性)
    const gender = typeof response.gender === 'string' && 
      (response.gender === 'male' || response.gender === 'female') 
      ? response.gender 
      : '?';
    // 获取图片
    const imageUrl:string = response.images.grid;
    const BimageUrl:string = response.images.small;
    // 返回数据
    return {
      nameCn: nameCn,
      jname,
      gender,
      imageUrl,
      BimageUrl,
      summary: response.summary,
      popularity: response.stat.collects,
      id: characterId
    };
  }catch (error){
    if (config.outputLogs === true){
      logger.error("获取角色信息错误,可能是token失效：",error);
    }  
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
    return filteredCharacters;
  } catch (error) {
    console.error('从作品获取角色错误:', error);
    return;
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

async function searchSubjects(keyword, ctx:Context, config) {// 根据关键词搜索作品
  try {
    // 请求api
    const response = await ctx.http.post(`https://api.bgm.tv/v0/search/subjects`, {
      keyword: keyword.trim(),
      filter: {
        type: [2, 4],  // 动画与游戏

      }
    });
    if (!response || !response.data) {
      return [];
    }
    // console.log('搜作品结果：', response);
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
    if (config.outputLogs === true){
      logger.error('关键词搜索作品错误:', error);
    }
    console.error('关键词搜索作品错误:', error);
    return [];
  }
}

async function getRandomCharacter(ctx:Context, config) {// 根据用户设置随机获取角色（答案）
  try {
    // 初始变量
    let subject:number;
    let randomOffset;
    let filteredCharacters: any[];
    const batchSize = 10;
    let total;
    let batchOffset;
    let indexInBatch;

    // 自建题库模式
    if (config.qtype === '使用自建题库' && config.indexId){
      const indexInfo = await getIndexInfo(config.indexId, ctx);// 获取目录信息
      randomOffset = Math.floor(Math.random() * indexInfo.total);// 生成随机偏移量
      batchOffset = Math.floor(randomOffset / batchSize) * batchSize;
      indexInBatch = randomOffset % batchSize;
      if(config.outputLogs === true){
        logger.info(`
          此次随机角色请求参数：https://api.bgm.tv/v0/indices/${config.indexId}/subjects?limit=1&offset=${randomOffset}
          若返回结果失败，则请前往 https://bangumi.github.io/api/#/%E7%9B%AE%E5%BD%95/getIndexById 自行尝试看看能否请求成功
          `);
      }
      //请求api从题库选择一个作品
      const indexResponse = await ctx.http.get(`https://api.bgm.tv/v0/indices/${config.indexId}/subjects?limit=${batchSize}&offset=${batchOffset}`)//从索引选择一个作品
      if (!indexResponse || !indexResponse.data || indexResponse.data.length === 0) {
        logger.error('此目录未找到作品！');
      }
      if(config.outputLogs === true){
        const all_resid = indexResponse.data.map(item => item.id);
        logger.info("范围题库的response：", all_resid);
        logger.info('此次选择的id是：',indexResponse.data[Math.min(indexInBatch, indexResponse.data.length)].id)
      }
      subject = indexResponse.data[Math.min(indexInBatch, indexResponse.data.length)].id;
    }else{
    // 设置范围模式
    total = config.rank;
    randomOffset = Math.floor(Math.random() * total);
    const endDate = new Date(`${config.end_year + 1}-01-01`);
    const today = new Date();
    const minDate = new Date(Math.min(endDate.getTime(), today.getTime())).toISOString().split('T')[0];
    batchOffset = Math.floor(randomOffset / batchSize) * batchSize;
    indexInBatch = randomOffset % batchSize;
    const metaTags = [config.form,config.origin,config.atype];// 合并用户选择的分类
   
    if(config.outputLogs === true){// logger内容
      const log_meta_tags = metaTags.filter(tag => tag !== "全部");
      console.log(`
        此次随机角色请求参数：
        post：(https://api.bgm.tv/v0/search/subjects?limit=${batchSize}&offset=${batchOffset},{
        "sort": "heat",
        "filter": {
        "type": [2],
        "air_date": [
        air-date: >=${config.start_year}-01-01 <${minDate}
        meta_tags: ${log_meta_tags}
        若返回结果失败，则请前往 https://bangumi.github.io/api/#/%E6%9D%A1%E7%9B%AE/searchSubjects 自行尝试看看能否请求成功
        `)
    }
    // 请求api，过滤作品类型
    const response = await ctx.http.post(`https://api.bgm.tv/v0/search/subjects?limit=${batchSize}&offset=${batchOffset}`,{
      "sort": "heat",
      "filter": {
        "type": [2],
        "air_date": [
          `>=${config.start_year}-01-01`,
          `<${minDate}`
        ],
        "meta_tags": metaTags.filter(tag => tag !== "全部")// 根据过滤条件获取
      }
    });

    if (!response || !response.data || response.data.length === 0) {
      logger.error('范围题库随机获取作品失败！');
    }
    
    if(config.outputLogs === true){ // 在日志显示获取的所有id
      const all_resid = response.data.map(item => item.id);
      logger.info("范围题库的response：", all_resid);
      logger.info('此次选择的id是：',response.data[Math.min(indexInBatch, response.data.length)].id)
    }
    subject = response.data[Math.min(indexInBatch, response.data.length)].id;
    }

    // 获取作品中的角色
    if(config.outputLogs === true){
      logger.info("获取的作品subjectId为：",subject);
    }
    console.log("获取的作品subjectId为：",subject);
      
    const characters = await getCharactersBySubjectId(subject,ctx);
    // 过滤主配角
    if (config.roles === '仅主角'){
      filteredCharacters = characters.filter(character => character.relation === '主角').slice(0, config.op_chatag);
    }else{
      filteredCharacters = characters.filter(character => character.relation === '主角' || character.relation === '配角').slice(0, config.persub_chanum);
    }
    if (filteredCharacters.length === 0) {
      console.log('此作品中未找到角色');
    }
    // 随机选择角色
    const selectedCharacter = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];
    console.log("获取的随机角色id为：",selectedCharacter.id);
    // 获取角色额外细节
    const characterDetails = await getCharacterDetails(selectedCharacter.id, ctx, config);
    // 获取角色出场信息
    const appearances = await getCharacterApperance(selectedCharacter.id, ctx, config);
    // 返回数据
    return {
      selectedCharacter,
      characterDetails,
      appearances
    };
  } catch (error) {
    if (config.outputLogs === true){
      logger.error('生成答案失败：', error);
    }
    console.log("获取随机角色错误：", error);
    return;
  }
}

async function generateFeedback(guess, answerCharacter) {// 根据用户答案和正确答案计算反馈
  try {
    const result: Feedback = {
      gender: { guess: guess.gender, feedback: '' },
      popularity: { guess: guess.popularity, feedback: '' },
      rating: { guess: guess.highestRating, feedback: '' },
      shared_appearances: { first: [], count: 0 },
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



async function generateSearchImg(pptr, input_result, config) {// 渲染搜索图片
  try {
    const page = await pptr.browser.newPage();
    const result = input_result;
    const searchHTML = `
    <!DOCTYPE html>
    <html>
        <head>
        <title>charactertable</title>
        <style>
            html {
                width: 600px;
                height: auto;
            }
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            .background {
                width: 100%;
                height: auto;
                padding: 8px;
                background: linear-gradient(to right bottom, #FCCF31, #F55555);
                overflow: hidden;
            }
            .base-plate {
                width: 100%;
                height: auto;
                box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
                padding: 5px;
                border-radius: 10px;
                background-color: #FFF5EE;
            }
            .card {
                width: auto;
                height: auto;
                border-radius: 5px;
                padding: 15px;
                overflow: hidden;
                background-color: #fff;
                position: relative;
            }
            table {
                width: 100%;
                margin: auto;
                table-layout: auto;
                border-collapse: separate;	/* 让border-radius有效 */
                border-spacing: 0; 
                border-radius: 10px;
                overflow: hidden;
                text-align: center;
            }
            table thead tr, table tbody tr {
                height: auto;
                line-height: auto;
            }
            table td {
                padding: 10px;
                font-family: Arial, sans-serif;
            }
            table tr {
                background: #ffffff;
                color: rgb(0, 0, 0);
                font-weight: bold;
            }
            table th {
                background: #f68c3b;
                color: rgb(0, 0, 0);
                font-weight: bold;
            }
        </style>
        </head>
        <body>
            <div class="background">
                <div class="base-plate">
                    <table>
                        <thead>
                            <tr>
                            <th>头像</th><th>名字</th><th>日文名</th><th>ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.map(result => srerch_TableRow(result)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
    </html>
    `;
    await page.setContent(searchHTML);
    const elementHandle = await page.$("html");
    const boundingBox = await elementHandle.boundingBox();
    const screenshot = await page.screenshot({
      type: "png",
      clip: {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
      },
    });
    await page.close();
    return screenshot;
  } catch (error) {
    if (config.outputLogs === true){
      logger.error('渲染关键词搜索图片出错：', error);
    }  
  }
}
function srerch_TableRow(result:sCharacter) {//生成搜索结果表格行
  // console.log('生成表格内参：', result.name, result.id);
  return `
    <tr>
      <td><img src="${result.imgurl}" style="height: 50px;width: 50px;border-radius: 10px;"></td>
      <td>${result.name}</td>
      <td>${result.jname}</td>
      <td>${result.id}</td>
    </tr>
  `;
}

async function generateImg(pptr, input_character, config) {// 渲染回答展示表格图片
  try {
    const page = await pptr.browser.newPage();
    const characters = input_character;

    const answertableHTML = `
    <!DOCTYPE html>
    <html>
    <head>
    <title>charactertable</title>
      <style>
        html {
          width: 1200px;
          height: auto;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }   
        .background {
            width: 100%;
            height: auto;
            padding: 8px;
            background: linear-gradient(to right bottom, #FCCF31, #F55555);
            overflow: hidden;
            min-height: 500px;
        }
        .base-plate {
            width: 100%;
            height: auto;
            box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
            padding: 5px;
            border-radius: 10px;
            background-color: #fcf3f9;
            min-height: 500px;
        }
        .card {
            width: auto;
            height: auto;
            border-radius: 5px;
            padding: 15px;
            overflow: hidden;
            background-color: #fff;
            position: relative;
        }
        table {
          width: 100%;
          margin: auto;
          table-layout: auto;
          background-color: #FBFBFB; 
          border-collapse: separate;	/* 让border-radius有效 */
          border-spacing: 0; 
          border-radius: 10px;
          overflow: hidden;
          text-align: center;
        }
        table thead tr, table tbody tr {
          height: auto;
          line-height: auto;
        }
        table tr {
          background: #ffffff;
          color: rgb(0, 0, 0);
          font-weight: bold;
        }
        table th {
          background: #f68c3b;
          color: rgb(0, 0, 0);
          font-weight: bold;
        }          
        table tbody tr td { /*分隔框*/
          border-left: 1px solid #000000;
          border-bottom: 1px solid #000000;
        }
        table tbody tr td:first-child {
          border-left: none; 
        }
        table tbody tr:last-child td {
          border-bottom: none; 
        }
      </style>
    </head>
    <body>
        <div class="background">
            <div class="base-plate">
                <table>
                    <thead>
                      <tr>
                        <th>名字</th><th>性别</th><th>人气值</th><th>作品数<br>最高分</th><th>最早登场<br>最晚登场</th><th>该角色与答案相同的标签</th><th>共同出演</th>
                      </tr>
                    </thead>
                    <tbody>
                        ${characters.map(character => ans_TableRow(character)).join('')}
                  </table>
            </div>
        </div>
    </body>
    </html>
    `;

    await page.setContent(answertableHTML);
    const elementHandle = await page.$("html");
    const boundingBox = await elementHandle.boundingBox();
    const screenshot = await page.screenshot({
      type: "png",
      clip: {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
      },
    });
    await page.close();
    return screenshot;
  } catch (error) {
    if (config.outputLogs === true){
      logger.error("渲染回答展示表格图片出错：", error);
    }  
  }
}
function ans_TableRow(character: Character): string {// 生成答案表格行
  return `
    <tr>
    <td style="vertical-align: middle; text-align: center;">
        <img src="${character.imgurl}" style="height: 38px; width: 38px; border-radius: 15px; margin-right: 8px; vertical-align: middle;">
        <span style="vertical-align: middle;">${character.name}</span>
    </td>
    <td>${character.gender}</td>
    <td>${character.popularity}</td>
    <td>${character.workscount}<br>${character.highestRating}</td>
    <td>${character.earliestAppearance}<br>${character.latestAppearance}</td>
    <td style="max-width: 70px;">${character.tags.join(', ')}</td> 
    <td>${character.shared_appearances}</td>
</tr>
  `;
}

async function generateResultImg(pptr, answer, config, result) {// 渲染回答正确图片
  try {
    let res_sen;
    const page = await pptr.browser.newPage();
    if (result === '正确') {
      res_sen = "✨恭喜回答正确🎉";
    } else if (result === '错误') {
      res_sen = "请再接再厉~🥺";
    } else if (result === '次数') {
      res_sen = "👆🤓次数已用尽了哦~";
    }
    
  const resHTML = `
    <!DOCTYPE html>
    <html>
    <head>
    <title>答案</title>
        <style>
            @font-face {
                font-family: "Custom Font";
            }
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            html {
                width: 800px;
                height: auto;
            }
            .background {
                width: 100%;
                height: auto;
                padding: 15px;
                background: linear-gradient(to right bottom, #FCCF31, #F55555);
                overflow: hidden;
            }
            .base-plate {
                width: 100%;
                height: auto;
                box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
                padding: 15px;
                border-radius: 10px;
                background-color: #FFF5EE;
            }
            .card {
                width: 100%;
                height: auto;
                border-radius: 5px;
                padding: 15px;
                overflow: hidden;
                background-color: #fff;
                position: relative;
            }
            .card img {
                border-radius: 5px 5px 0 0;
                max-width: 100%;
                /* 设置最大宽度为容器宽度的100% */
                max-height: 80%;
                /* 设置最大高度为容器高度的90% */
            }
            .card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 5px;
                margin-bottom: 10px;
            }
            .card-title {
                line-height: 50px;
            }
            .card-body {
                padding: 2px 16px;
                margin-bottom: 10px;
            }
            .character-info {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }
            .anchor-avatar {
                width: 50px;
                /* 头像大小 */
                height: auto;
                box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
            }
            .character-message {
                display: inline-block;
                margin-left: 10px;
                font-size: 20px;
                color: #333;
            }
            .card-text {
                color: grey;
                font-size: 20px;
            }
            .card-link {
                display: flex;
                justify-content: space-between;
                text-decoration: none;
                font-size: 20px;
                margin-top: 10px;
                margin-bottom: 10px;
            }
            .corner-text{
                position: absolute;
                top: 0; 
                right: 0; 
                margin-top: 100px;
                margin-right: 150px;
                color: rgb(0, 0, 0); 
                font-size: 40px;
                font-family: Arial, Helvetica, sans-serif;
            }
        </style>
    </head>
    <body>
        <div class="background">
            <div class="base-plate">
                <div class="card">                    
                        <img src="${answer.bigImgurl}"
                        alt="立绘">
                        <div class="corner-text">
                            ${res_sen}
                        </div>
                    <div class="card-body">
                        <div class="card-header">
                            <h1 class="card-title">${answer.name}</h1>
                            <div class="character-info">
                                <!-- 头像 -->
                                <img style="border-radius: 10px; margin-left: 10px" class="anchor-avatar"
                                    src="${answer.imgurl}" alt="头像">
                                <span class="character-message">ID:${answer.id}</span>
                            </div>
                        </div>
                        <p class="card-text">${answer.summary}</p>
                        <p class="card-link">
                            <span>人气：${answer.popularity}</span>
                            <span>代表作品：《${answer.work}》</span><br>
                        </p>
                    </div>
    </body>
    </html>
  `
  await page.setContent(resHTML);
  const elementHandle = await page.$("html");
  const boundingBox = await elementHandle.boundingBox();
  const buffer = await page.screenshot({
    type: "png",
    clip: {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height,
    },
  });
  return buffer;
  } catch (error) {
    if (config.outputLogs === true){
      logger.error('渲染正确回答后的反馈图片失败：', error);
    }
  }
  
}





