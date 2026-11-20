#!/usr/bin/env python3
"""Give every browser asset a content-specific cache key at publication."""
from pathlib import Path
import hashlib,re
root=Path(__file__).resolve().parent.parent/'dist'
def version(match):
 prefix,name=match.groups()
 digest=hashlib.sha256((root/name).read_bytes()).hexdigest()[:16]
 return f'{prefix}"{name}?v={digest}"'

icons=r'icons/[a-zA-Z0-9_-]+\.png'
manifest=root/'manifest.webmanifest'
manifest.write_text(re.sub(rf'("src"\s*:\s*)"({icons})(?:\?[^"]*)?"',version,manifest.read_text()))
page=root/'index.html'
assets=rf'[a-zA-Z0-9_-]+\.(?:js|css|svg|webmanifest)|{icons}'
page.write_text(re.sub(rf'((?:src|href)=)"({assets})(?:\?[^"]*)?"',version,page.read_text()))
