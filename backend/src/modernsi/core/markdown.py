"""
Safe Markdown for user texts: no raw HTML, no images, links open in a new tab with rel=nofollow ugc noopener.
markdown-it already refuses javascript:, vbscript:, file: and data: links.
This work made by Anfinogentov Nikita
"""
from markdown_it import MarkdownIt

md = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": False}).enable("strikethrough").disable("image")


def render_link_open(self, tokens, index, options, env):
    tokens[index].attrSet("rel", "nofollow ugc noopener")
    tokens[index].attrSet("target", "_blank")
    return self.renderToken(tokens, index, options, env)


md.add_render_rule("link_open", render_link_open)


def render_markdown(text):
    return md.render(text or "")
