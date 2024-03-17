import { Context, h, Logger, Schema } from 'koishi'
import Censor from '@koishijs/censor'

export const name = 'rr-image-censor'
export const usage = `
<style>
@keyframes rot {
  0% {
    transform: rotateZ(0deg);
  }
  100% {
    transform: rotateZ(360deg);
  }
}
.rotationStar {
  display: inline-block;
  animation: rot 0.5s linear infinite;
  opacity: 1;
  transition: 1.5s cubic-bezier(0.4, 0, 1, 1);
}
.rotationStar:hover {
  opacity: 0;
  transition: 0.35s cubic-bezier(0.4, 0, 1, 1);
}
{/* (谢谢你, 露娜歪)[https://github.com/Lipraty] */}
</style>

<span class="rotationStar">⭐</span>人人计划图像审核插件，使用教程请点击[插件主页](https://forum.koishi.xyz/t/topic/117?u=mirrorcy)哦<span class="rotationStar">⭐</span>
`
const logger = new Logger(name)

export function apply(ctx: Context, config: Config) {
  ctx.plugin(Censor)
  ctx.inject(['censor'], (ctx) => {
    ctx.i18n.define('zh-CN', { 'rr-image-censor.detected_unsafe_images': '不可以涩涩！' })
    const _dispose = ctx.censor.intercept({
      async image(attrs) {
        const base64 = Buffer.from((await ctx.http.file(attrs.url)).data).toString('base64')
        const data: NsfwCheck = { image: base64 }
        const { concept_scores } = await ctx.http.post('http://api.t4wefan.pub:51317/check_safety', data)
          .catch((e) => { logger.error(e) }) as ReviewResult // 草 写的好丑
        if (!concept_scores) return h.image(attrs.url)
        const unsafe = concept_scores.some((score, i) => score + config.offset > config.threshold[i])
        if (config.debug) logger.info(`Got an image with scores: \n${concept_scores.join('\n')}`)
        if (!unsafe) return h.image(attrs.url)
        return h.i18n('rr-image-censor.detected_unsafe_images')
      }
    })
    ctx.on("dispose", () => { _dispose() })
  })
}

export const Config: Schema<Config> = Schema.object({
  debug: Schema.boolean().description('调试模式，打印每张图的评分到日志。').default(false),
  offset: Schema.number().description('审核强度整体偏移量。').default(-0.016).max(1.0).min(-1.0),
  threshold: Schema.array(Schema.number()).default(Array(17).fill(0.0)).collapse().experimental().description('每个分类的阈值微调。').min(17).max(17)
})

export interface Config {
  debug?: boolean
  offset?: number
  threshold?: number[]
}
export interface NsfwCheck {
  image: string
}
export interface ReviewResult {
  concept_scores: number[]
}
