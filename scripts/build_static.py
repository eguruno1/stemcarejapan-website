"""Stage public assets only; internal docs and repository files are never deployed."""
from pathlib import Path
from shutil import copy2,copytree
root=Path(__file__).resolve().parents[1]
out=root/'dist';out.mkdir(exist_ok=True)
copy2(root/'index.html',out/'index.html')
for folder in ('korea-travel','stemcell','guide','css','js','images'):
    copytree(root/folder,out/folder,dirs_exist_ok=True,ignore=lambda directory,names:[n for n in names if n.startswith('.') or n.endswith('.md')])
print('Public static site staged in dist/')
