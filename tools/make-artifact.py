# Convert the single-file build into an Artifact page fragment (the host adds doctype/head/body).
import sys, re
src, out = sys.argv[1], sys.argv[2]
h = open(src, encoding='utf-8').read()
title = re.search(r'<title>(.*?)</title>', h, re.S).group(1)
styles = ''.join(re.findall(r'<style[^>]*>.*?</style>', h, re.S))
scripts = ''.join(re.findall(r'<script[^>]*>.*?</script>', h, re.S))
open(out, 'w', encoding='utf-8').write(f'<title>{title}</title>\n<meta name="description" content="Night Courier: rain-soaked neon hover-bike courier game.">\n{styles}\n{scripts}\n')
