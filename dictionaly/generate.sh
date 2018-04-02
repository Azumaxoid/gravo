iconv -f UTF-8 -t eucjp word.yomi | yomi2voca.pl > word.voca
mkdfa.pl word
