docker run \
  --name julius \
  --net=host \
  -t \
  -v ../dictionaly:/dictionaly
  -v ../dictation-kit-v4.4:/dictation-kit-v4.4
  --device=/dev/dsp1:/dev/dsp:rw
  --rm fabito/julius
  julius -C /dictionaly/word.jconf -charconv sjis utf8 -module
