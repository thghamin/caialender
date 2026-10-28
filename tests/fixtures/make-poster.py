from PIL import Image, ImageDraw, ImageFont
W,H=1080,1350
im=Image.new("RGB",(W,H),"#1e1b4b"); d=ImageDraw.Draw(im)
F=lambda s,b=False: ImageFont.truetype("/mnt/c/Windows/Fonts/malgunbd.ttf" if b else "/mnt/c/Windows/Fonts/malgun.ttf", s)
d.rectangle([60,60,W-60,H-60],outline="#facc15",width=6)
d.text((W/2,170),"2027 AI전공",font=F(56,True),fill="#facc15",anchor="mm")
d.text((W/2,270),"현직자 초청 특강",font=F(96,True),fill="white",anchor="mm")
d.text((W/2,380),"\"LLM 서비스, 현업에서는 이렇게 만든다\"",font=F(42),fill="#c7d2fe",anchor="mm")
y=520
for k,v in [("일시","3월 18일(목) 오후 4시 ~ 6시"),("장소","IT-5호관 224호"),("연사","네이버클라우드 AI Lab 김OO 님"),("대상","인공지능전공 2~4학년"),("신청","3월 15일(월)까지 학생회 구글폼")]:
    d.text((150,y),k,font=F(46,True),fill="#facc15"); d.text((330,y),v,font=F(46),fill="white"); y+=110
d.text((W/2,1150),"선착순 60명 · 간식 제공",font=F(44,True),fill="#fda4af",anchor="mm")
d.text((W/2,1230),"주최: 인공지능전공 학생회",font=F(34),fill="#a5b4fc",anchor="mm")
im.save("/tmp/aieval/poster1.png")
