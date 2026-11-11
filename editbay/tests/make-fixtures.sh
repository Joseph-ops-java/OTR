#!/usr/bin/env bash
# Generates the larger test clips with ffmpeg (the small ones are committed in media/).
set -euo pipefail
cd "$(dirname "$0")/media"
F="-hide_banner -loglevel error -y"
# 20 s long-GOP 1080p, Rec.709 tagged: frame-accurate decoding, reverse playback, grading
[ -f gop.mp4 ] || ffmpeg $F -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=20" -vf "scale=out_color_matrix=bt709:out_range=tv" \
  -c:v libx264 -preset veryfast -g 250 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv gop.mp4
# two multicam angles sharing one soundtrack, B starts 0.8 s later: audio sync
if [ ! -f camA.mp4 ] || [ ! -f camB.mp4 ]; then
  ffmpeg $F -f lavfi -i "anoisesrc=d=11:c=pink:r=44100:a=0.3" -af "volume='if(lt(mod(t,1),0.08),3,0.4)':eval=frame" -ac 1 shared.wav
  ffmpeg $F -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=10" -i shared.wav -t 10 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -ac 1 camA.mp4
  ffmpeg $F -f lavfi -i "smptebars=size=1280x720:rate=30:duration=10" -ss 0.8 -i shared.wav -t 10 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -ac 1 camB.mp4
  rm -f shared.wav
fi
# phone-style variable frame rate, and HEVC (most browsers here can't decode it: tests the explanation)
[ -f vfr.mp4 ] || ffmpeg $F -f lavfi -i "testsrc2=size=1280x720:rate=60,format=yuv420p" -f lavfi -i "sine=f=440:r=48000" -t 10 \
  -vf "setpts='PTS+0.02*sin(N)/TB'" -fps_mode vfr -c:v libx264 -preset veryfast -c:a aac -shortest vfr.mp4
[ -f hevc.mp4 ] || ffmpeg $F -f lavfi -i "testsrc2=size=1280x720:rate=30" -t 4 -c:v libx265 -tag:v hvc1 -pix_fmt yuv420p -x265-params log-level=error hevc.mp4

# spoken words for the caption tests (espeak-ng text-to-speech)
if [ ! -f speech.mp4 ] && command -v espeak-ng >/dev/null; then
  espeak-ng -s 140 -w speech.wav "Welcome to Dark Out. Doors open at half ten at The Hidden Attic. DJ Samszy plays R and B, hip hop and old school all night."
  ffmpeg $F -f lavfi -i "testsrc2=size=1280x720:rate=30" -i speech.wav -shortest -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac speech.mp4
  rm -f speech.wav
fi
echo "speech fixture ready"
