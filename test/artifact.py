import re,sys
d='public/'
h=open(d+'index.html').read()
css=open(d+'style.css').read(); js=open(d+'app.js').read()
head=re.search(r'<head>(.*)</head>',h,re.S).group(1)
body=re.search(r'<body>(.*)</body>',h,re.S).group(1)
head=re.sub(r'<meta charset[^>]*>\n|<meta name="viewport"[^>]*>\n|<meta name="theme-color"[^>]*>\n|<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n','',head)
head=head.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
body=body.replace('<script src="app.js"></script>','<script>'+js+'</script>')
open(sys.argv[1],'w').write(head+body)
