"""Check generated routes, translations, IDs, local links and assets without browser automation."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self,path):
        super().__init__(convert_charrefs=True);self.path=path;self.ids=set();self.refs=[];self.errors=[];self.options=[];self.feed(path.read_text())
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:
            if a['id'] in self.ids:self.errors.append('duplicate ID '+a['id'])
            self.ids.add(a['id'])
        if ('data-ja' in a)!=('data-ko' in a):self.errors.append('missing translation')
        if tag in ('a','link','script','img'):
            ref=a.get('href') if tag in ('a','link') else a.get('src')
            if ref is not None:self.refs.append(ref)
        if tag=='option':self.options.append(a.get('value'))
paths=list((ROOT/'korea-travel').rglob('index.html'));cache={p:Page(p) for p in paths};errors=[]
for p,page in cache.copy().items():
    errors += [str(p)+': '+e for e in page.errors]
    assert page.options==['airport','seoul-tour','business'],p
    assert 'quote-form' in page.ids and 'contact' in page.ids,p
    assert 'tables/inquiries' not in p.read_text(),p
    assert 'tel:02-1234-5678' not in p.read_text(),p
    for ref in page.refs:
        u=urlsplit(ref)
        if u.scheme or u.netloc:continue
        target=(ROOT/unquote(u.path.lstrip('/'))) if u.path.startswith('/') else (p.parent/unquote(u.path)) if u.path else p
        target=target.resolve()
        if target.is_dir():target=target/'index.html'
        if not target.exists():errors.append(f'{p}: missing {ref}');continue
        if u.fragment:
            if target not in cache:cache[target]=Page(target)
            if u.fragment not in cache[target].ids:errors.append(f'{p}: missing fragment {ref}')
assert not errors,'\n'.join(errors)
print(f'PASS: {len(paths)} travel routes; assets, local links, anchors, unique IDs, translations, quote forms')
