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
    ccb_command: Schema.string().default("ccb").description("`游戏开始`的指令名称"),
  }).description('基础设置'),
]);

interface Gaming {
  [channelId: string]: boolean
}


export function apply(ctx: Context, config) {
  const API_BASE_URL = 'https://api.bgm.tv';
  let games: Gaming = {}

  ctx.command(config.ccb_command)
    .action(async ({session}) => {
      
    });
}

async function getSubjectDetails(subjectID, response){
  try{
    // 获取失败处理
    if(!response.data){
      console.log('获取作品信息无数据返回')
    }
    // 判断是否已播出
    const airDate = response.data.date;
    const currentDate = new Date();
    if (airDate && new Date(airDate) > currentDate) {
      return null;// 未播出则返回null 
    }
    // 已播出则提取年份
    let year = airDate ? parseInt(airDate.split('-')[0]) : null;
    // 提取标签tag
    const tags = new Set();
    if (response.data.type === 2) {
      response.data.tags.slice(0, 10).filter(tag => !tag.name.includes('20')).forEach(tag => tags.add(tag.name));
    }
    if (response.data.type === 4) {
      response.data.tags.slice(0, 5).filter(tag => !tag.name.includes('20')).forEach(tag => tags.add(tag.name));
    }

    


  }catch (error){
    console.error('获取作品信息错误：',error);
  }
}
