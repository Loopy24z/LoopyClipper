"""Video-only motion, applied after reframing and before caption compositing."""
import math

def motion_scale(mode, time, amount=.1):
    t = max(0, time)
    a = max(.04, min(.16, amount))
    if mode == 'opening': return 1 + a * max(0, 1-t/3)
    if mode == 'subtle': return 1 + a * (1-math.cos(t*math.pi/4))/2
    if mode == 'rhythm': return 1 + a * (math.floor(t/4) % 2)
    return 1

def motion_filter(clip, width, height):
    mode = clip.get('motion', 'none')
    if mode == 'none': return ''
    amount = float(clip.get('motionAmount', .1))
    if mode not in ('opening', 'subtle', 'rhythm') or not .04 <= amount <= .16:
        raise ValueError('Invalid video motion setting.')
    expression = {'opening': 'max(0,1-on/90)', 'subtle': '(1-cos(on*PI/120))/2', 'rhythm': 'mod(floor(on/120),2)'}[mode]
    position = max(0, min(100, float(clip['position']))) / 100
    return f",fps=30,zoompan=z='1+{amount}*({expression})':x='(iw-iw/zoom)*{position}':y='(ih-ih/zoom)/2':d=1:s={width}x{height}:fps=30"
