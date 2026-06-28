declare module 'critters' {
  interface CrittersOptions {
    path?: string
    publicPath?: string
    preload?: 'body' | 'swap' | 'js' | 'media' | boolean
    inlineFonts?: boolean
    pruneSource?: boolean
    minimumExternalSize?: number
    reduceInlineStyles?: boolean
    [key: string]: unknown
  }

  export default class Critters {
    constructor(options?: CrittersOptions)
    process(html: string): Promise<string>
  }
}
