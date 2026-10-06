"""Create LoofyAI's procedural instrumental loops. No samples or third-party music."""
import math, wave, array, pathlib, random
root=pathlib.Path(__file__).resolve().parents[1]/'public'/'audio'
root.mkdir(exist_ok=True)
rate=22050
for name,bpm in [('pulse',120),('calm',90)]:
    beat=60/bpm; duration=16*beat; rng=random.Random(73); pcm=array.array('h')
    notes=[130.8128,164.8138,195.9977,164.8138,110,130.8128,164.8138,130.8128]
    for n in range(round(rate*duration)):
        t=n/rate; phase=t%beat; eighth=t%(beat/2); k=int(t/(beat/2))%8
        tone=(math.sin(2*math.pi*notes[k]*2*t)+.3*math.sin(2*math.pi*notes[k]*4*t))*math.exp(-eighth*8)*.11
        bass=math.sin(2*math.pi*(65.4064 if int(t/(beat*4))%2==0 else 55)*t)*.12
        kick=math.sin(2*math.pi*(48*phase+5*(1-math.exp(-phase*35))))*math.exp(-phase*18)*(.32 if name=='pulse' else .12)
        hat=(rng.random()*2-1)*math.exp(-eighth*100)*(.06 if name=='pulse' else .018)
        envelope=min(1,t/.015,(duration-t)/.015)
        pcm.append(int(max(-.95,min(.95,(tone+bass+kick+hat)*envelope))*32767))
    with wave.open(str(root/(name+'.wav')),'wb') as out:
        out.setparams((1,2,rate,0,'NONE','not compressed'));out.writeframes(pcm.tobytes())
    print(name,len(pcm)/rate,'seconds')
