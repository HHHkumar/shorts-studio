#!/usr/bin/env python
"""
Turn USER_GUIDE.md into a printable PDF.

    npm run guide:pdf          (or: python tools/guide-to-pdf.py)

There is no HTML-to-PDF converter on this machine - no pandoc, no wkhtmltopdf,
no headless browser bindings - so this walks the markdown token stream and
typesets it with reportlab directly. That is more code than piping through a
converter, but it means the tables actually paginate, the code blocks keep their
line breaks, and the headings become real PDF bookmarks.

Two things worth knowing if you edit this:

  * Fonts are the Windows system fonts, embedded. ReportLab's built-in Type 1
    faces cover almost none of what the guide uses - not the em dash, not the
    arrows, and none of the symbols - so text set in them comes out as black
    boxes. Segoe UI carries the typography and Segoe UI Symbol carries the rest,
    and every character is checked against the font's own cmap rather than
    assumed.

  * Table cells are Paragraphs, not strings. A string in a reportlab table is
    one unbreakable line, which silently runs off the page; the troubleshooting
    table has three columns of full sentences and would be unreadable.
"""

import io
import os
import re
import sys
from datetime import date

from markdown_it import MarkdownIt
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont, TTFontFile
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Preformatted, Spacer, Table, TableStyle,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'USER_GUIDE.md')
OUTPUT = os.path.join(ROOT, 'Shorts Studio - User Guide.pdf')

# --- palette ---------------------------------------------------------------
# Print, not screen: dark text on white, and an accent dark enough to stay
# legible if the thing is run off on a mono printer.
INK = colors.HexColor('#16181d')
DIM = colors.HexColor('#5b6270')
ACCENT = colors.HexColor('#2f4fd0')
RULE = colors.HexColor('#d7dae1')
CODE_BG = colors.HexColor('#f4f5f8')
QUOTE_BG = colors.HexColor('#f7f9fc')
HEAD_BG = colors.HexColor('#eceff5')

FONT_DIR = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')

BODY, BOLD, ITALIC, BOLDITALIC = 'Body', 'Body-Bold', 'Body-Italic', 'Body-BoldItalic'
# NOT 'Symbol': that is one of reportlab's reserved base-14 PDF font names, so
# registering a TTF under it is silently ignored and every fallback character
# gets set in the built-in Symbol face - which has none of these glyphs and
# prints a solid black box for each one.
MONO, MONO_BOLD, SYMBOL = 'Mono', 'Mono-Bold', 'SegoeSymbol'

_symbol_cmap = set()
_body_cmap = set()


def register_fonts():
    """Embed the system fonts, and remember which glyphs each actually has."""
    global _symbol_cmap, _body_cmap
    faces = [
        (BODY, 'segoeui.ttf'), (BOLD, 'segoeuib.ttf'),
        (ITALIC, 'segoeuii.ttf'), (BOLDITALIC, 'segoeuiz.ttf'),
        (MONO, 'consola.ttf'), (MONO_BOLD, 'consolab.ttf'),
        (SYMBOL, 'seguisym.ttf'),
    ]
    for name, filename in faces:
        path = os.path.join(FONT_DIR, filename)
        if not os.path.exists(path):
            sys.exit('Missing font: ' + path)
        pdfmetrics.registerFont(TTFont(name, path))

    pdfmetrics.registerFontFamily(BODY, normal=BODY, bold=BOLD, italic=ITALIC, boldItalic=BOLDITALIC)
    pdfmetrics.registerFontFamily(MONO, normal=MONO, bold=MONO_BOLD, italic=MONO, boldItalic=MONO_BOLD)

    _body_cmap = set(TTFontFile(os.path.join(FONT_DIR, 'segoeui.ttf')).charToGlyph)
    _symbol_cmap = set(TTFontFile(os.path.join(FONT_DIR, 'seguisym.ttf')).charToGlyph)


# --- inline text -----------------------------------------------------------

# Invisible on screen and a missing glyph in every font we embed, so it would
# print as a black box for no benefit at all.
VARIATION_SELECTORS = re.compile(r'[\uFE00-\uFE0F]')


def esc(text):
    return (text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def with_fallback(text):
    """Wrap any character the body font lacks in the symbol font."""
    out = []
    run = []
    run_is_symbol = False

    def flush():
        if not run:
            return
        chunk = esc(''.join(run))
        out.append('<font face="%s">%s</font>' % (SYMBOL, chunk) if run_is_symbol else chunk)
        run.clear()

    for ch in text:
        needs_symbol = ord(ch) > 127 and ord(ch) not in _body_cmap and ord(ch) in _symbol_cmap
        if needs_symbol != run_is_symbol:
            flush()
            run_is_symbol = needs_symbol
        run.append(ch)
    flush()
    return ''.join(out)


def inline(token, mono=False):
    """Render one markdown inline token tree as reportlab's mini-HTML."""
    parts = []
    for child in token.children or []:
        t = child.type
        if t == 'text':
            parts.append(with_fallback(VARIATION_SELECTORS.sub('', child.content)))
        elif t == 'code_inline':
            # No padding spaces inside the chip: they push following
            # punctuation away and read as "npm.cmd , or run".
            parts.append('<font face="%s" size="9" backColor="#eef0f4">%s</font>'
                         % (MONO, with_fallback(child.content)))
        elif t == 'strong_open':
            parts.append('<b>')
        elif t == 'strong_close':
            parts.append('</b>')
        elif t == 'em_open':
            parts.append('<i>')
        elif t == 'em_close':
            parts.append('</i>')
        elif t == 's_open':
            parts.append('<strike>')
        elif t == 's_close':
            parts.append('</strike>')
        elif t == 'link_open':
            href = child.attrGet('href') or ''
            # An in-document anchor is meaningless once the numbering is on the
            # page in front of you; only real URLs stay clickable.
            parts.append('' if href.startswith('#') else '<link href="%s" color="#2f4fd0">' % esc(href))
            child.meta = {'internal': href.startswith('#')}
        elif t == 'link_close':
            parts.append('')
        elif t in ('softbreak', 'hardbreak'):
            parts.append('<br/>' if t == 'hardbreak' else ' ')
    text = ''.join(parts)
    # Close the links we opened; markdown_it guarantees they are balanced.
    opens = text.count('<link ')
    closes = text.count('</link>')
    return text + '</link>' * max(0, opens - closes)


# --- styles ----------------------------------------------------------------

def build_styles():
    base = dict(fontName=BODY, textColor=INK, alignment=TA_LEFT)
    return {
        'body': ParagraphStyle('body', fontSize=9.8, leading=14.6, spaceAfter=7, **base),
        'h1': ParagraphStyle('h1', fontName=BOLD, fontSize=25, leading=29, spaceBefore=0,
                             spaceAfter=14, textColor=INK, alignment=TA_LEFT),
        'h2': ParagraphStyle('h2', fontName=BOLD, fontSize=16.5, leading=21, spaceBefore=20,
                             spaceAfter=9, textColor=ACCENT, alignment=TA_LEFT),
        'h3': ParagraphStyle('h3', fontName=BOLD, fontSize=12.2, leading=16, spaceBefore=14,
                             spaceAfter=6, textColor=INK, alignment=TA_LEFT),
        'h4': ParagraphStyle('h4', fontName=BOLD, fontSize=10.4, leading=14, spaceBefore=11,
                             spaceAfter=4, textColor=DIM, alignment=TA_LEFT),
        'li': ParagraphStyle('li', fontSize=9.8, leading=14.4, spaceAfter=3.5, **base),
        'quote': ParagraphStyle('quote', fontSize=9.6, leading=14.4, spaceAfter=5,
                                fontName=BODY, textColor=colors.HexColor('#2c3444'),
                                alignment=TA_LEFT),
        'cell': ParagraphStyle('cell', fontSize=8.9, leading=12.4, spaceAfter=0, **base),
        'cellhead': ParagraphStyle('cellhead', fontName=BOLD, fontSize=8.9, leading=12.4,
                                   spaceAfter=0, textColor=INK, alignment=TA_LEFT),
        'code': ParagraphStyle('code', fontName=MONO, fontSize=8.6, leading=12.2,
                               textColor=colors.HexColor('#1d2330')),
        'cover_sub': ParagraphStyle('cover_sub', fontName=BODY, fontSize=12.5, leading=18,
                                    textColor=DIM, alignment=TA_LEFT),
    }


# --- the walk --------------------------------------------------------------

class GuideBuilder:
    def __init__(self, styles, frame_width):
        self.s = styles
        self.width = frame_width
        self.flow = []
        self.headings = []

    # tables ---------------------------------------------------------------
    def _column_widths(self, rows):
        """Share the width out by how much text each column actually holds."""
        cols = max(len(r) for r in rows)
        weight = [0.0] * cols
        for row in rows:
            for i, cell in enumerate(row):
                # Square-rooted so one very long cell cannot starve the others.
                weight[i] = max(weight[i], len(cell) ** 0.5)
        total = sum(weight) or 1
        # No column narrower than 12% of the table, or short cells become a
        # column of single letters.
        share = [max(0.12, w / total) for w in weight]
        scale = sum(share)
        return [self.width * s / scale for s in share]

    def add_table(self, header, rows):
        raw = ([header] if header else []) + rows
        widths = self._column_widths([[c['text'] for c in r] for r in raw])

        data = []
        for r_i, row in enumerate(raw):
            style = self.s['cellhead'] if (header and r_i == 0) else self.s['cell']
            data.append([Paragraph(c['html'], style) for c in row])

        table = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign='LEFT')
        style = [
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LINEBELOW', (0, 0), (-1, -2), 0.4, RULE),
            ('BOX', (0, 0), (-1, -1), 0.6, RULE),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]
        if header:
            style += [('BACKGROUND', (0, 0), (-1, 0), HEAD_BG),
                      ('LINEBELOW', (0, 0), (-1, 0), 0.8, RULE)]
        table.setStyle(TableStyle(style))
        self.flow += [Spacer(1, 4), table, Spacer(1, 10)]

    # code -----------------------------------------------------------------
    def add_code(self, text):
        lines = text.rstrip('\n').split('\n')
        body = Preformatted('\n'.join(lines), self.s['code'])
        holder = Table([[body]], colWidths=[self.width], hAlign='LEFT')
        holder.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), CODE_BG),
            ('BOX', (0, 0), (-1, -1), 0.5, RULE),
            ('LEFTPADDING', (0, 0), (-1, -1), 9),
            ('RIGHTPADDING', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))
        # A short command and its explanation should not be split across a page.
        self.flow += [Spacer(1, 3), KeepTogether(holder) if len(lines) <= 6 else holder, Spacer(1, 9)]

    def add_quote(self, inner):
        holder = Table([[inner]], colWidths=[self.width], hAlign='LEFT')
        holder.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), QUOTE_BG),
            ('LINEBEFORE', (0, 0), (0, -1), 2.4, ACCENT),
            ('LEFTPADDING', (0, 0), (-1, -1), 11),
            ('RIGHTPADDING', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        self.flow += [Spacer(1, 3), holder, Spacer(1, 9)]


def convert(tokens, styles, width):
    b = GuideBuilder(styles, width)
    i = 0
    list_stack = []      # ('bullet', None) or ('ordered', next_number)
    quote_depth = 0
    quote_buffer = []

    def emit(flowable):
        (quote_buffer if quote_depth else b.flow).append(flowable)

    while i < len(tokens):
        t = tokens[i]

        if t.type == 'heading_open':
            level = int(t.tag[1])
            text = inline(tokens[i + 1])
            plain = re.sub(r'<[^>]+>', '', text)
            key = 'h%d' % min(level, 4)
            para = Paragraph(text, styles[key])
            para._bookmark = (plain, level)
            b.headings.append((plain, level))
            # A heading alone at the foot of a page is an orphan.
            b.flow.append(para if level == 1 else KeepTogether([para, Spacer(1, 1)]))
            i += 3
            continue

        if t.type == 'paragraph_open':
            text = inline(tokens[i + 1])
            if list_stack:
                kind, number = list_stack[-1]
                marker = '&bull;' if kind == 'bullet' else '%d.' % number
                para = Paragraph('<font color="#5b6270">%s</font>&nbsp;&nbsp;%s' % (marker, text),
                                 styles['li'])
                para.style = ParagraphStyle('li_ind', parent=styles['li'],
                                            leftIndent=14 * len(list_stack))
                emit(para)
            else:
                emit(Paragraph(text, styles['quote'] if quote_depth else styles['body']))
            i += 3
            continue

        if t.type == 'fence':
            if quote_depth:
                emit(Preformatted(t.content.rstrip('\n'), styles['code']))
            else:
                b.add_code(t.content)
            i += 1
            continue

        if t.type == 'bullet_list_open':
            list_stack.append(['bullet', 0])
            i += 1
            continue
        if t.type == 'ordered_list_open':
            list_stack.append(['ordered', int(t.attrGet('start') or 1)])
            i += 1
            continue
        if t.type in ('bullet_list_close', 'ordered_list_close'):
            list_stack.pop()
            if not list_stack:
                emit(Spacer(1, 5))
            i += 1
            continue
        if t.type == 'list_item_open':
            i += 1
            continue
        if t.type == 'list_item_close':
            if list_stack and list_stack[-1][0] == 'ordered':
                list_stack[-1][1] += 1
            i += 1
            continue

        if t.type == 'blockquote_open':
            quote_depth += 1
            i += 1
            continue
        if t.type == 'blockquote_close':
            quote_depth -= 1
            if quote_depth == 0:
                b.add_quote(list(quote_buffer))
                quote_buffer.clear()
            i += 1
            continue

        if t.type == 'table_open':
            header, rows, current, in_head = None, [], None, False
            i += 1
            while tokens[i].type != 'table_close':
                tt = tokens[i].type
                if tt == 'thead_open':
                    in_head = True
                elif tt == 'thead_close':
                    in_head = False
                elif tt == 'tr_open':
                    current = []
                elif tt in ('th_open', 'td_open'):
                    cell = tokens[i + 1]
                    current.append({'html': inline(cell), 'text': cell.content})
                    i += 2
                elif tt == 'tr_close':
                    # `header` is one ROW of cells, not a list of rows - getting
                    # that wrong nests the list and the width maths reads a dict
                    # where it expects a string.
                    if in_head and header is None:
                        header = current
                    else:
                        rows.append(current)
                i += 1
            b.add_table(header, rows)
            i += 1
            continue

        if t.type == 'hr':
            b.flow.append(Spacer(1, 4))
            b.flow.append(HRFlowable(width='100%', thickness=0.6, color=RULE,
                                     spaceBefore=2, spaceAfter=10))
            i += 1
            continue

        i += 1

    return b



# --- document --------------------------------------------------------------

class Doc(BaseDocTemplate):
    """Adds the running footer and turns headings into PDF bookmarks."""

    _outline_depth = -1

    def afterFlowable(self, flowable):
        bookmark = getattr(flowable, '_bookmark', None)
        if not bookmark:
            return
        text, level = bookmark
        # The outline may only ever go one level deeper than the last entry.
        # The guide's own top heading lives on the cover, so its first real
        # heading is an h2 - which without this clamp asks the outline to start
        # at depth 1 and reportlab refuses outright.
        depth = min(max(0, level - 2), self._outline_depth + 1)
        self._outline_depth = depth
        key = 'sec-%d-%d' % (self.page, abs(hash(text)) % 100000)
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=depth, closed=(depth >= 1))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY, 8)
    canvas.setFillColor(DIM)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    y = 13 * mm
    canvas.line(doc.leftMargin, y + 5 * mm, A4[0] - doc.rightMargin, y + 5 * mm)
    canvas.drawString(doc.leftMargin, y, 'Shorts Studio - User Guide')
    canvas.drawRightString(A4[0] - doc.rightMargin, y, str(canvas.getPageNumber()))
    canvas.restoreState()


def cover(styles, width):
    return [
        Spacer(1, 58 * mm),
        Paragraph('Shorts Studio', styles['h1']),
        Paragraph('The complete guide', styles['cover_sub']),
        Spacer(1, 9),
        HRFlowable(width=64 * mm, thickness=2.4, color=ACCENT, spaceAfter=13),
        Paragraph(
            'You do not need to know how to code to use this. '
            'If you can copy and paste, you can run it.', styles['body']),
        Spacer(1, 4),
        Paragraph('Generated %s' % date.today().isoformat(), styles['body']),
        PageBreak(),
    ]


def main():
    register_fonts()

    src = io.open(SOURCE, encoding='utf-8').read()
    # The heading and the standfirst are on the cover instead.
    src = re.sub(r'\A#\s+[^\n]*\n+', '', src)
    src = re.sub(r'\AYou do not need to know how to code[^\n]*\n(?:[^\n]*\n)?', '', src)

    md = MarkdownIt('commonmark').enable('table').enable('strikethrough')
    tokens = md.parse(src)

    styles = build_styles()
    margin = 19 * mm
    width = A4[0] - margin * 2

    doc = Doc(OUTPUT, pagesize=A4, leftMargin=margin, rightMargin=margin,
              topMargin=17 * mm, bottomMargin=23 * mm,
              title='Shorts Studio - User Guide', author='Shorts Studio')
    frame = Frame(margin, 23 * mm, width, A4[1] - 17 * mm - 23 * mm, id='body',
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=footer)])

    built = convert(tokens, styles, width)
    doc.build(cover(styles, width) + built.flow)

    size = os.path.getsize(OUTPUT)
    print('  wrote %s' % os.path.basename(OUTPUT))
    print('  %d KB, %d headings bookmarked' % (size / 1024, len(built.headings)))


if __name__ == '__main__':
    main()
