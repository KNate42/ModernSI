"""
Markdown from users must never turn into live HTML, scripts or tracking images.
This work made by Anfinogentov Nikita
"""
from modernsi.core.markdown import render_markdown


async def test_raw_html_is_escaped():
    html = render_markdown("<script>alert(1)</script> <b>bold</b>")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "<b>" not in html


async def test_javascript_links_are_not_links():
    html = render_markdown("[click](javascript:alert(1))")
    assert "href" not in html


async def test_links_get_safe_rel():
    html = render_markdown("[site](https://example.org)")
    assert 'href="https://example.org"' in html
    assert 'rel="nofollow ugc noopener"' in html
    assert 'target="_blank"' in html


async def test_images_are_not_rendered():
    html = render_markdown("![pixel](https://tracker.example/p.gif)")
    assert "<img" not in html


async def test_basic_formatting_survives():
    html = render_markdown("**Plan**\n\n- cook\n- share")
    assert "<strong>Plan</strong>" in html
    assert "<li>cook</li>" in html
