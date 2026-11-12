"""Build the Spanish practice report with the managed python-docx runtime."""
from pathlib import Path
import re
import json
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs/evidencias/seguridad-apis'
OUT = ROOT / 'docs/entregables'
OUT.mkdir(parents=True, exist_ok=True)

img = Image.new('RGB', (1500, 660), 'white')
draw = ImageDraw.Draw(img)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 28)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 23)
def box(x,y,w,h,lines):
    draw.rounded_rectangle((x,y,x+w,y+h),radius=14,fill='#edf2f7',outline='#293a4a',width=3)
    for i,line in enumerate(lines):
        draw.text((x+w/2,y+20+i*36),line,font=font,fill='#17212b',anchor='mt')
def arrow(a,b,label=None):
    draw.line((a,b),fill='#52677c',width=4)
    x,y=b
    if b[0]>a[0]: draw.polygon([(x,y),(x-14,y-8),(x-14,y+8)], fill='#52677c')
    else: draw.polygon([(x,y),(x-8,y-14),(x+8,y-14)],fill='#52677c')
    if label:
        pos=((a[0]+b[0])/2,(a[1]+b[1])/2-25)
        bounds=draw.textbbox(pos,label,font=small,anchor='mm')
        draw.rectangle((bounds[0]-4,bounds[1]-3,bounds[2]+4,bounds[3]+3),fill='white')
        draw.text(pos,label,font=small,fill='#17212b',anchor='mm')
box(40,80,300,100,['Navegador','Catálogo y panel'])
box(560,40,340,100,['Vercel','Next.js'])
box(560,220,340,100,['Supabase API','Deno y Prisma'])
box(1110,220,330,100,['PostgreSQL','Datos del sistema'])
box(40,380,300,100,['Supabase Auth','Identidad'])
box(560,470,340,100,['Storage y jobs','Imágenes y cola'])
box(1110,470,330,100,['Resend','Correo previsto'])
arrow((340,100),(560,100),'HTTPS')
arrow((340,165),(560,260),'HTTPS JSON')
arrow((190,180),(190,380),'HTTPS')
arrow((340,420),(560,300),'Validar token')
arrow((900,270),(1110,270),'TLS 1.3')
arrow((730,320),(730,470))
arrow((900,520),(1110,520),'HTTPS')
draw.text((750,620),'WhatsApp: enlace wa.me; no envío mediante Business API',font=small,fill='#17212b',anchor='mm')
img.save(EVIDENCE/'arquitectura.png')

text = (ROOT/'docs/seguridad-apis.md').read_text(encoding='utf8')
if '{{PUBLICATION_STATUS}}' in text:
    raise RuntimeError('Complete publication status before building the report')
doc = Document()
section = doc.sections[0]
section.page_width, section.page_height = Inches(8.5), Inches(11)
section.top_margin = section.bottom_margin = Inches(.65)
section.left_margin = section.right_margin = Inches(.75)
for name in ['Normal','Title','Heading 1','Heading 2','Heading 3']:
    style=doc.styles[name]
    style.font.name='Arial'
    style.font.color.rgb=RGBColor(0,0,0)
    style.font.size=Pt(11 if name=='Normal' else 26 if name=='Title' else 16 if name=='Heading 1' else 12)
    style.paragraph_format.space_after=Pt(6)
    if name=='Normal': style.paragraph_format.line_spacing=1.08
doc.core_properties.title='Seguridad de APIs y despliegue de Lowkey Saints'
doc.core_properties.author='Equipo Lowkey Saints'
doc.core_properties.subject='Desarrollo Web Integral Unidad III'
footer=section.footer.paragraphs[0]
footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('Lowkey Saints  |  ')
field=OxmlElement('w:fldSimple'); field.set(qn('w:instr'),'PAGE'); footer._p.append(field)
for run in footer.runs: run.font.size=Pt(9)

def clean(value): return value.replace('**','').replace('`','')
def table(lines):
    rows=[[clean(c.strip()) for c in line.strip().strip('|').split('|')] for line in lines if not re.match(r'^\|[\s:|\-]+\|$',line)]
    t=doc.add_table(rows=0,cols=len(rows[0])); t.style='Table Grid'
    for index,values in enumerate(rows):
        cells=t.add_row().cells
        for cell,value in zip(cells,values):
            cell.text=value
            for p in cell.paragraphs:
                p.paragraph_format.space_after=Pt(4)
                p.paragraph_format.space_before=Pt(4)
                p.paragraph_format.line_spacing=1
                for r in p.runs:
                    r.font.size=Pt(10)
                    if index==0: r.bold=True
            if index==0:
                fill=OxmlElement('w:shd'); fill.set(qn('w:fill'),'E9EEF3'); cell._tc.get_or_add_tcPr().append(fill)
        props=t.rows[-1]._tr.get_or_add_trPr()
        keep=OxmlElement('w:cantSplit'); props.append(keep)
        if index==0: props.append(OxmlElement('w:tblHeader'))
    doc.add_paragraph().paragraph_format.space_after=Pt(0)

lines=text.splitlines(); i=0; first=True
while i<len(lines):
    line=lines[i].strip()
    if not line: i+=1; continue
    if line=='<!-- page -->': doc.add_page_break()
    elif line.startswith('|'):
        group=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            group.append(lines[i].strip()); i+=1
        table(group); continue
    elif line.startswith('!['):
        match=re.match(r'!\[(.*?)\]\((.*?)\)',line)
        path=ROOT/'docs'/match.group(2)
        p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(path),width=Inches(5.0 if 'sistema' in path.name else 6.7))
        p.paragraph_format.keep_with_next=True
    elif line.startswith('# '):
        doc.add_paragraph(clean(line[2:]),style='Title' if first else 'Heading 1'); first=False
    elif line.startswith('## '): doc.add_paragraph(clean(line[3:]),style='Heading 2')
    else:
        p=doc.add_paragraph(clean(line))
        if line.startswith('Figura '):
            for r in p.runs: r.italic=True; r.font.size=Pt(9)
    i+=1
for root in [doc.styles.element, doc.element]:
    for border in list(root.xpath('.//w:pBdr')):
        border.getparent().remove(border)
doc.styles['Title'].font.underline=False
doc.save(OUT/'Lowkey_Saints_Seguridad_APIs_Despliegue.docx')
print('DOCX created')
