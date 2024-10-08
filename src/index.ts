import { Context, Dict, h, Schema } from 'koishi'
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

export function apply(ctx: Context, config: Config) {
  ctx.plugin(Censor)
  ctx.inject(['censor'], (ctx) => {
    ctx.i18n.define('zh-CN', { 'rr-image-censor.detected_unsafe_images': '不可以涩涩！' })
    const censor = async (attrs: Dict) => {
      attrs.src ||= attrs.url
      const base64 = Buffer.from((await ctx.http.file(attrs.src)).data).toString('base64')
      const data: NsfwCheck = { image: base64 }
      const { concept_scores } = await ctx.http.post('https://censor.elchapo.cn/check_safety', data)
        .catch((e) => { ctx.logger.error(e) }) as ReviewResult
      if (!concept_scores) return h.image(attrs.url)
      const unsafe = concept_scores.some((score, i) => score + config.offset > config.threshold[i])
      if (config.debug) ctx.logger.info(`Got an image with scores: \n${concept_scores.join('\n')}`)
      if (!unsafe) return h.image(attrs.src)
      return h.i18n('rr-image-censor.detected_unsafe_images')
    }
    const _dispose = ctx.censor.intercept({
      async img(attrs) { return await censor(attrs) },
      async image(attrs) { return await censor(attrs) }
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
