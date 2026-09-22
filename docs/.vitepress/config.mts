import { defineConfig } from 'vitepress'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { formatTwoslashError } from './twoslash-errors'

const hostname = 'https://ai.langium.org'
const ogImage = `${hostname}/og-image.png`
const siteDescription = 'AI toolbox for grounding LLMs on Langium DSLs with evaluation, constraints, and agent skills'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Langium AI",
  description: siteDescription,

  sitemap: { hostname },

  // static half of the link preview: the card image and its shape. the
  // per-page title/description/url half is added in `transformPageData`.
  head: [
    ['link', { rel: 'icon', href: '/lai.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Langium AI' }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'Langium AI: AI toolbox for grounding LLMs on Langium DSLs' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: ogImage }]
  ],

  // every page gets its own title, description, and canonical URL in the
  // unfurl. VitePress emits `<title>` and `<meta name="description">` on its
  // own, but no Open Graph or Twitter equivalents.
  transformPageData(pageData) {
    const isHome = pageData.frontmatter.layout === 'home'
    const title = isHome || !pageData.title
      ? 'Langium AI'
      : `${pageData.title} | Langium AI`

    // `cleanUrls` is off, so built pages live at `<path>.html`; index pages
    // collapse to their directory.
    const path = pageData.relativePath
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '.html')
    const url = `${hostname}/${path}`

    // pageData.description is '' unless the page declares one in frontmatter
    const description = pageData.description || siteDescription

    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['link', { rel: 'canonical', href: url }]
    )
  },

  vite: {
    build: {
      chunkSizeWarningLimit: 1024,
      rolldownOptions: {
        output: {
          codeSplitting: true
        }
      }
    }
  },

  // Lane 1 of the gate: `ts twoslash` blocks are compiled (never executed)
  // against the pinned npm packages. A type error fails `docs:build`.
  markdown: {
    codeTransformers: [transformerTwoslash({
      // rewrite twoslash's opaque char-offset errors into file:line:column
      // reports with the offending source line, then still fail the build.
      onTwoslashError(error, code) {
        const readable = formatTwoslashError(error, code)
        if (readable) {
          console.error('\n' + readable + '\n')
        }
        throw error
      }
    })],
    // twoslash emits language ids like `ts twoslash`; keep the base language.
    // every fence language used across the docs must be registered here, plus
    // `json`: twoslash type-hover popovers pretty-print object types as JSON and
    // Shiki needs that grammar to render them.
    languages: ['ts', 'js', 'json', 'jsonc', 'yaml', 'bash']
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quickstart', link: '/quickstart' },
      { text: 'langium-ai-tools', link: '/langium-ai-tools/' },
      { text: 'lai CLI', link: '/langium-ai/' },
      { text: 'Skills', link: '/skills/' }
    ],

    sidebar: {
      '/langium-ai-tools/': [
        {
          text: 'langium-ai-tools',
          items: [
            { text: 'Overview', link: '/langium-ai-tools/' },
            { text: 'Install', link: '/langium-ai-tools/install' },
            { text: 'Splitter', link: '/langium-ai-tools/splitter' },
            { text: 'Evaluator', link: '/langium-ai-tools/evaluator' },
            { text: 'Evals', link: '/langium-ai-tools/evals' },
            { text: 'Analyzer', link: '/langium-ai-tools/analyzer' },
            { text: 'Evaluating tool calls', link: '/langium-ai-tools/tool-calls' },
            { text: 'Evaluating MCP', link: '/langium-ai-tools/mcp' },
            { text: 'Examples', link: '/langium-ai-tools/examples' }
          ]
        }
      ],
      '/langium-ai/': [
        {
          text: 'langium-ai (lai CLI)',
          items: [
            { text: 'Overview', link: '/langium-ai/' },
            { text: 'Install', link: '/langium-ai/install' },
            { text: 'Usage', link: '/langium-ai/usage' },
            { text: 'Examples', link: '/langium-ai/examples' }
          ]
        }
      ],
      '/skills/': [
        {
          text: 'Agent Skills',
          items: [
            { text: 'Overview', link: '/skills/' },
            { text: 'Reference Skills', link: '/skills/reference' },
            { text: 'Actionable Skills', link: '/skills/actionable' },
            { text: 'Typical Workflow', link: '/skills/workflow' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/eclipse-langium/langium-ai' }
    ]
  }
})
