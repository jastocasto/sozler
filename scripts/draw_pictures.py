"""Line drawings made for SÖZ's picture quiz.

    python3 scripts/draw_pictures.py

Writes scripts/content/pictures/drawn.json: {concept: {"word": primary word, "svg": inner SVG}}.
Every drawing sits on the same 72 x 72 grid as the OpenMoji line set the quiz also
uses, with a 2 px round stroke in currentColor (set on the wrapping <svg>). Concept
ids come from scripts/content/pictures/concepts.tsv. Drawings are original work for
this project (AI-assisted, reviewed on contact sheets), CC BY-SA 4.0.
"""
import json
import math
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'content', 'pictures', 'drawn.json')
D = {}


def n(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def draw(concept, word, *parts, category=None, group=None):
    """category is needed only for a word-only concept ('word:papaq') that the candidate list does not hold.
    group names drawings built on the same base (a bust with a pointer): the quiz never shows two of one group together."""
    assert concept not in D, concept
    D[concept] = {'word': word, 'svg': ''.join(parts), **({'category': category} if category else {}), **({'group': group} if group else {})}


def p(d, **a):
    extra = ''.join(f' {k.replace("_", "-")}="{v}"' for k, v in a.items())
    return f'<path d="{d}"{extra}/>'


def c(x, y, r, fill=False, **a):
    extra = ''.join(f' {k.replace("_", "-")}="{v}"' for k, v in a.items())
    return f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(r)}"{" fill=\"currentColor\"" if fill else ""}{extra}/>'


def e(x, y, rx, ry, fill=False, rot=None):
    t = f' transform="rotate({n(rot)} {n(x)} {n(y)})"' if rot else ''
    return f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{n(rx)}" ry="{n(ry)}"{" fill=\"currentColor\"" if fill else ""}{t}/>'


def r(x, y, w, h, rx=0, **a):
    extra = ''.join(f' {k.replace("_", "-")}="{v}"' for k, v in a.items())
    return f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}"{f" rx=\"{n(rx)}\"" if rx else ""}{extra}/>'


def pl(*pts, w=None, closed=False):
    tag = 'polygon' if closed else 'polyline'
    sw = f' stroke-width="{w}"' if w else ''
    return f'<{tag} points="{" ".join(n(v) for v in pts)}"{sw}/>'


def g(transform, *parts):
    return f'<g transform="{transform}">{"".join(parts)}</g>'


def waves(x, y, count, w=8, h=3):
    return p(f'M{n(x)} {n(y)}q{n(w / 2)} {n(-h)} {n(w)} 0' + f't{n(w)} 0' * (count - 1))


def bez(p0, p1, p2, p3, t):
    return tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * cc + t ** 3 * d
                 for a, b, cc, d in zip(p0, p1, p2, p3))


def leaf(x, y, angle, length=10, width=4, fill=False):
    """Almond-shaped leaf from (x, y) pointing at angle (degrees)."""
    a = math.radians(angle)
    tx, ty = x + length * math.cos(a), y + length * math.sin(a)
    nx, ny = -math.sin(a) * width, math.cos(a) * width
    mx, my = (x + tx) / 2, (y + ty) / 2
    return p(f'M{n(x)} {n(y)}Q{n(mx + nx)} {n(my + ny)} {n(tx)} {n(ty)}Q{n(mx - nx)} {n(my - ny)} {n(x)} {n(y)}Z',
             **({'fill': 'currentColor'} if fill else {}))


def tree(x, ground, h=20, r_=8):
    return p(f'M{n(x)} {n(ground)}V{n(ground - h + r_)}') + c(x, ground - h, r_)


def figure(head, *limbs, r_=4.5):
    """Pictogram person: filled head and thick limbs (polylines)."""
    return c(*head, r_, fill=True) + ''.join(pl(*limb, w=4.5) for limb in limbs)


def cloud(x, y, s=1.0):
    k = lambda v: n(v * s)
    return p(f'M{n(x - 14 * s)} {n(y + 6 * s)}a{k(6)} {k(6)} 0 0 1 {k(1)}-{k(11.5)}a{k(9)} {k(9)} 0 0 1 {k(16)}-{k(4)}'
             f'a{k(7)} {k(7)} 0 0 1 {k(12)} {k(5)}a{k(5.5)} {k(5.5)} 0 0 1 -{k(1)} {k(10.5)}Z')


# ---------------------------------------------------------------- nature
draw('bridge.n.01', 'körpü',
     p('M4 30H68M4 35H68'), p('M4 22H68'), *[p(f'M{x} 22V30') for x in range(10, 68, 8)],
     p('M12 52Q36 26 60 52'), p('M20 35V44.8M28 35V40.4M44 35V40.4M52 35V44.8'),
     p('M6 35V52M66 35V52'), waves(6, 58, 7), waves(14, 64, 5))
draw('lake.n.01', 'göl',
     e(38, 50, 28, 11), waves(26, 47, 2, 6, 2), waves(40, 53, 2, 6, 2), waves(30, 56, 1, 6, 2),
     p('M10 44V24M15 42V30M6 45V32'), e(10, 22, 1.8, 4, fill=True), e(15, 28, 1.6, 3.5, fill=True),
     e(6, 30, 1.6, 3.5, fill=True), p('M20 36L30 26L36 31L44 22L56 34'), tree(60, 40, 18, 7))
draw('forest.n.02', 'meşə',
     p('M4 62H68'), pl(36, 6, 25, 24, 31, 24, 21, 38, 29, 38, 19, 52, 53, 52, 43, 38, 51, 38, 41, 24, 47, 24, closed=True),
     p('M36 52V62'), tree(12, 62, 24, 8), tree(60, 62, 26, 9))
draw('sea.n.01', 'dəniz',
     p('M4 30H68'), p('M25 30a11 11 0 0 1 22 0'), p('M36 14V9M24 19l-3-3M48 19l3-3M18 26h-4M54 26h4'),
     waves(4, 40, 8), waves(8, 50, 7), waves(4, 60, 8))
draw('tunnel.n.01', 'tunel',
     p('M2 56L20 22L29 31L40 12L70 56'), p('M22 56V44a14 14 0 0 1 28 0V56'),
     p('M28 56V46a8 8 0 0 1 16 0V56', fill='currentColor'), p('M28 56L18 68M44 56L54 68'), p('M36 60V62M36 65V67'),
     p('M2 56H22M50 56H70'))
draw('river.n.01', 'irmaq',
     p('M33 8C26 18 40 24 30 34C20 44 28 52 12 66'), p('M40 8C36 18 52 24 44 34C34 46 54 54 50 66'),
     waves(30, 48, 1, 6, 2), waves(36, 26, 1, 5, 2), waves(26, 58, 2, 6, 2),
     p('M2 14Q14 4 28 11M45 11Q58 2 70 12'), tree(12, 44, 14, 5), tree(62, 50, 14, 5))
draw('hill.n.01', 'təpə',
     p('M2 62C14 32 44 30 60 62'), p('M38 42C48 26 62 24 70 36'), p('M2 62H70'), tree(30, 38, 16, 6),
     c(58, 12, 5), p('M58 3V1M66 12h2M64 6l2-2'))
draw('cave.n.01', 'mağara',
     p('M2 60H70'), p('M4 60C6 40 14 26 30 20C44 14 58 22 64 36C68 44 68 52 68 60'),
     p('M20 60C20 46 27 37 36 37C45 37 52 46 52 60Z', fill='currentColor'),
     p('M42 22l6 5M14 40l4-6M56 33l4 5M28 28l-5 3'))
draw('waterfall.n.01', 'şəlalə',
     p('M4 14H22C22 30 18 44 20 54'), p('M36 14H68'), p('M36 14C38 30 42 44 40 54'),
     p('M20 8Q29 12 38 8'), p('M25 14V52M30 14V52M35 14V52', stroke_width=1.5),
     e(30, 60, 24, 5), p('M14 52l-4-4M46 52l4-4M30 50v-3'), p('M50 26l8 4M56 40l8-2M8 30l6 4'))
draw('smoke.n.01', 'tüstü',
     r(12, 46, 14, 20), r(10, 42, 18, 4), p('M4 66H68'),
     cloud(27, 32, 0.6), cloud(38, 21, 0.8), cloud(52, 10, 0.85))
draw('grass.n.01', 'ot',
     p('M4 62H68'),
     *[p(f'M{x} 62C{x + 1} {54 - h} {x - 4} {46 - h} {x - 8} {40 - h}') for x, h in ((16, 0), (40, 4), (62, -2))],
     *[p(f'M{x} 62C{x} {52 - h} {x + 3} {44 - h} {x + 8} {36 - h}') for x, h in ((18, -2), (42, 6), (64, 2))],
     *[p(f'M{x} 62V{36 - h}') for x, h in ((12, -6), (28, 4), (34, -2), (52, 0))],
     p('M24 62C25 52 22 44 18 38M48 62C48 52 52 46 56 42'))
draw('branch.n.02', 'budaq',
     p('M4 52C20 46 40 36 68 20'), p('M24 44L30 30M44 34L54 40M56 27L60 16'),
     leaf(30, 30, -80, 12, 4), leaf(30, 30, -20, 11, 4), leaf(54, 40, 30, 11, 4), leaf(54, 40, 90, 10, 3.5),
     leaf(60, 16, -60, 10, 3.5), leaf(16, 48, 110, 11, 4), leaf(40, 38, 100, 10, 3.5), leaf(68, 20, -30, 9, 3.5))
# ---------------------------------------------------------------- home
draw('table.n.02', 'stol',
     p('M14 20H58L64 26H8Z'), r(8, 26, 56, 5), p('M13 31V60M59 31V60M19 31V50M53 31V50'))
draw('button.n.01', 'düymə',
     c(36, 36, 24), c(36, 36, 18), c(30, 30, 3), c(42, 30, 3), c(30, 42, 3), c(42, 42, 3),
     p('M31.5 31.5L40.5 40.5M40.5 31.5L31.5 40.5', stroke_width=1.5))
draw('cupboard.n.01', 'dolab',
     r(16, 10, 40, 52, 2), p('M13 10H59'), p('M36 10V62'), p('M32 32V40M40 32V40'), p('M20 62V66M52 62V66'),
     r(21, 16, 10, 40, 1, stroke_width=1.2), r(41, 16, 10, 40, 1, stroke_width=1.2))
draw('swing.n.02', 'yelləncək',
     p('M10 10H62'), p('M10 10L4 64M10 10L16 64M62 10L56 64M62 10L68 64'), p('M26 10V46M46 10V46'),
     r(22, 46, 28, 4, 1))
draw('gate.n.01', 'darvaza',
     r(4, 20, 8, 44), r(60, 20, 8, 44), p('M3 20H13M59 20H69'), c(8, 17, 2), c(64, 17, 2),
     p('M12 60H60M12 44H60'), p('M12 30Q36 18 60 30'),
     p('M18 27.4V60M24 25.5V60M30 24.4V60M36 24V60M42 24.4V60M48 25.5V60M54 27.4V60'), p('M2 64H70'))
draw('fence.n.01', 'hasar',
     p('M2 60H70'), p('M4 34H68M4 50H68'),
     *[p(f'M{x} 60V26l4-6l4 6V60') for x in (6, 18, 30, 42, 54)])
draw('stairs.n.01', 'pilləkən',
     p('M6 62V56H18V46H30V36H42V26H54V16H66V62Z'),
     p('M12 56V46M24 46V36M36 36V26M48 26V16M60 16V6'), p('M12 46L60 6'))
draw('pillow.n.01', 'yastıq',
     p('M12 22C20 18 52 18 60 22C64 32 64 44 60 52C52 56 20 56 12 52C8 44 8 32 12 22Z'),
     p('M12 22l5 5M60 22l-5 5M12 52l5-5M60 52l-5-5'), p('M28 38q8 4 16 0'))
draw('towel.n.01', 'dəsmal',
     p('M6 14H66'), c(6, 14, 2), c(66, 14, 2), p('M18 14V60H54V14'), p('M18 22H54'),
     p('M18 48H54M18 53H54'), p('M22 60v4M30 60v4M38 60v4M46 60v4M50 60v4'))
draw('rug.n.01', 'xalça',
     r(14, 10, 44, 52), r(19, 15, 34, 42), p('M36 22L48 36L36 50L24 36Z'), p('M36 30L42 36L36 42L30 36Z'),
     p('M19 22l5-7M53 22l-5-7M19 50l5 7M53 50l-5 7'),
     *[p(f'M{x} 10V5M{x} 62V67') for x in range(16, 58, 4)])
draw('kettle.n.01', 'çaydan',
     p('M18 58C13 46 16 30 24 26H48C56 30 59 46 54 58Z'), p('M28 26C28 20 44 20 44 26'), c(36, 18, 2),
     p('M22 30C20 8 52 8 50 30'), p('M17 44C12 40 8 34 6 28L10 27C12 32 15 35 18 37'), p('M14 58H58'))
draw('sink.n.01', 'əlüz yuyan',
     p('M8 34H64C64 48 52 56 36 56C20 56 8 48 8 34Z'), p('M30 56V66H42V56'), p('M36 34V20H48V26'),
     p('M32 20H40'), p('M48 30v2M48 36v2'), e(36, 40, 6, 2))
draw('refrigerator.n.01', 'soyuducu',
     r(18, 6, 36, 60, 4), p('M18 26H54'), p('M24 13V20M24 32V45'), p('M22 66v2M50 66v2'))
draw('oven.n.01', 'duxovka',
     r(10, 14, 52, 50, 2), p('M10 24H62'), c(17, 19, 2), c(24, 19, 2), c(31, 19, 2), r(42, 17, 14, 4, 1),
     r(18, 34, 36, 22, 2), p('M20 29H52'), p('M24 44h4M32 44h4M40 44h4', stroke_width=1.5))
draw('bench.n.01', 'skamya',
     r(8, 14, 56, 6, 1), r(8, 24, 56, 6, 1), r(4, 36, 64, 6, 1), p('M14 14V36M58 14V36'),
     p('M10 42V60M62 42V60M14 42L10 52M58 42L62 52'))
draw('stool.n.01', 'kətil',
     e(36, 18, 18, 5), p('M18 18V22C18 26 54 26 54 22V18'), p('M22 24L16 62M50 24L56 62M31 26L29 58M41 26L43 58'),
     p('M20 44H52'))
draw('barrel.n.01', 'çəllək',
     p('M20 10C14 24 14 48 20 62H52C58 48 58 24 52 10Z'), p('M18 20Q36 24 54 20M16 36H56M18 52Q36 56 54 52'),
     p('M30 10C28 24 28 48 30 62M42 10C44 24 44 48 42 62', stroke_width=1.5))
draw('vase.n.01', 'vaza',
     p('M26 8H46'), p('M30 8C30 16 26 18 22 26C14 40 20 58 28 64H44C52 58 58 40 50 26C46 18 42 16 42 8'),
     p('M18 34H54M17 46H55'), p('M18 40l4-3l4 3l4-3l4 3l4-3l4 3l4-3l4 3', stroke_width=1.5))
draw('chimney.n.01', 'baca',
     p('M4 54L36 30L68 54'), p('M12 48V66M60 48V66'), p('M46 37V18H56V44.5'), p('M44 18H58'),
     p('M46 24H56M46 30H56M51 18V24M48 24V30M54 30V36M46 36H56', stroke_width=1.2), r(30, 50, 12, 16))
draw('shelf.n.01', 'rəf',
     p('M6 32H66M6 58H66'), p('M12 32l6 6M60 32l-6 6M12 58l6 6M60 58l-6 6'),
     r(12, 14, 5, 18), r(18, 12, 5, 20), r(24, 16, 5, 16), p('M30 31L36 15L40 16.5L34 32'),
     p('M50 32l-2-8h12l-2 8'), leaf(54, 24, -60, 9, 3), leaf(54, 24, -120, 9, 3),
     r(12, 44, 14, 14, 2), r(30, 42, 5, 16), r(36, 40, 5, 18), c(54, 52, 6))
draw('ladle.n.01', 'çömçə',
     p('M8 40C8 60 36 60 36 40Z'), p('M34 40C42 30 46 18 46 8'), p('M46 8c0-4 6-5 6 0'))
draw('funnel.n.01', 'qıf',
     p('M12 14C12 18 60 18 60 14'), p('M12 14C12 10 60 10 60 14L40 38V62H32V38Z'))
mesh = ''.join(p(f'M{x} {n(36 - h)}V{n(36 + h)}', stroke_width=1) for x, h in ((18, 12), (24, 15.9), (30, 17), (36, 15.9), (42, 12)))
mesh += ''.join(p(f'M{n(30 - h)} {y}H{n(30 + h)}', stroke_width=1) for y, h in ((24, 12), (30, 15.9), (36, 17), (42, 15.9), (48, 12)))
draw('sieve.n.01', 'xəlbir', c(30, 36, 20), c(30, 36, 17, stroke_width=1), mesh, p('M44 22L62 6', stroke_width=4))
draw('grater.n.01', 'rəndə',
     p('M22 14H50L56 62H16Z'), p('M28 14V7H44V14'),
     *[p(f'M{x} {y}h4', stroke_width=1.5) for y, xs in ((24, (25, 33, 41)), (32, (24, 32, 40)), (40, (23, 31, 39, 46)),
                                                       (48, (22, 30, 38, 46)), (56, (21, 29, 37, 45))) for x in xs])
draw('thermos.n.01', 'termos',
     r(26, 6, 20, 10, 2), p('M30 16V20M42 16V20'), r(22, 20, 28, 44, 6), p('M22 30H50M22 54H50'),
     p('M28 36V48', stroke_width=1.5))
draw('chandelier.n.01', 'çilçıraq',
     p('M36 2V14'), c(36, 18, 4), p('M33 22C26 34 16 32 13 26M39 22C46 34 56 32 59 26M36 22V34'),
     r(11, 18, 4, 8), r(57, 18, 4, 8), r(34, 34, 4, 8),
     p('M13 16q-2-3 0-6q2 3 0 6M59 16q-2-3 0-6q2 3 0 6M36 32q-2-3 0-6q2 3 0 6'),
     p('M22 34v5M50 34v5M28 42v4M44 42v4'), c(22, 41, 1.5, True), c(50, 41, 1.5, True))

# ---------------------------------------------------------------- clothes & accessories
draw('shirt.n.01', 'köynək',
     p('M18 26V64H54V26'), p('M26 10L14 14L6 50L13 52L18 26M46 10L58 14L66 50L59 52L54 26'),
     p('M26 10L28 20L36 17L44 20L46 10L36 14Z'), p('M36 17V64'), p('M7 46L14 48M65 46L58 48'),
     c(36, 27, 1.4, True), c(36, 37, 1.4, True), c(36, 47, 1.4, True), c(36, 57, 1.4, True), r(42, 28, 7, 7))
draw('sweater.n.01', 'sviter',
     p('M24 10L12 14L6 48L14 50L18 28V62H54V28L58 50L66 48L60 14L48 10C44 16 28 16 24 10Z'),
     p('M18 56H54'), *[p(f'M{x} 56V62', stroke_width=1.2) for x in range(22, 54, 4)], p('M7 44L15 46M65 44L57 46'),
     p('M18 34' + 'l4-4l4 4' * 4 + 'l4-4', stroke_width=1.5), p('M27 12C30 15 42 15 45 12', stroke_width=1.2))
draw('skirt.n.01', 'ətək',
     r(24, 12, 24, 7), p('M24 19L12 60H60L48 19'), p('M30 19L24 60M36 19V60M42 19L48 60'))
draw('belt.n.01', 'kəmər',
     p('M4 30H24M4 42H24'), p('M40 30H64Q68 36 64 42H40'), r(24, 26, 16, 20, 3), p('M28 36H40'),
     c(50, 36, 1.5, True), c(56, 36, 1.5, True), r(44, 29, 3, 14, 0.5, stroke_width=1.2))
draw('wallet.n.01', 'pulqabı',
     r(10, 22, 52, 34, 4), p('M44 30H62V46H44a8 8 0 0 1 0-16Z'), c(46, 38, 2), p('M18 22V14H38V22'),
     p('M22 22V18H34', stroke_width=1.2))
draw('trouser.n.01', 'şalvar',
     p('M20 8H52L56 64H40L36 26L32 64H16Z'), p('M20 14H52'), p('M36 14V26'), p('M22 14C24 20 28 21 31 14M50 14C48 20 44 21 41 14'))
draw('apron.n.01', 'önlük',
     p('M28 18C28 6 44 6 44 18'), p('M28 18H44V28C50 30 54 30 56 28L52 62H20L16 28C18 30 22 30 28 28Z'),
     p('M16 30l-9 5M56 30l9 5'), r(28, 42, 16, 10))
draw('earring.n.01', 'sırğa',
     p('M20 10C24 6 28 10 24 16'), c(24, 23, 6), p('M24 29L20 39L24 50L28 39Z'),
     p('M44 10C48 6 52 10 48 16'), c(48, 23, 6), p('M48 29L44 39L48 50L52 39Z'))
beads = [(14, 12), (18, 23.3), (22, 32.2), (26, 39), (30.5, 43.5), (41.5, 43.5), (46, 39), (50, 32.2), (54, 23.3), (58, 12)]
draw('necklace.n.01', 'boyunbağı',
     *[c(x, y, 2.4) for x, y in beads], c(36, 46, 2.4, True), p('M36 48.5V51'), p('M36 51L30 58L36 66L42 58Z'))
draw('bracelet.n.02', 'bilərzik',
     e(36, 40, 26, 13), e(36, 38, 20, 8.5), p('M30 27.5L36 22L42 27.5L36 31Z'), c(20, 30, 2), c(52, 30, 2))

# ---------------------------------------------------------------- tools
draw('sickle.n.01', 'oraq',
     p('M26 50C10 40 12 16 32 10C50 6 62 16 60 30C56 20 46 16 36 18C24 22 22 38 31 47Z'),
     p('M28 50L14 64', stroke_width=5))
draw('hoe.n.01', 'kətmən', p('M12 66L54 14', stroke_width=3), p('M48 10L66 22L60 28L46 18Z'))
draw('pliers.n.01', 'kəlbətin',
     p('M34 33L29 10Q33 4 36 10M38 33L43 10Q39 4 36 10'), c(36, 36, 3),
     p('M34 39C28 48 24 56 22 66M38 39C44 48 48 56 50 66'), p('M27 51L22 66M45 51L50 66', stroke_width=5))
draw('thimble.n.02', 'üskük',
     p('M24 60V32C24 14 48 14 48 32V60'), p('M22 60H50M24 55H48'),
     *[c(x, y, 1.1, True) for y, xs in ((26, (32, 36, 40)), (32, (29, 33, 37, 41, 45)), (38, (28, 32, 36, 40, 44)),
                                         (44, (28, 32, 36, 40, 44)), (50, (28, 32, 36, 40, 44))) for x in xs])
draw('corkscrew.n.01', 'ştopor',
     p('M14 14H58', stroke_width=5), p('M36 14V24'),
     p('M36 24c8 2 8 6 0 8c-8 2-8 6 0 8c8 2 8 6 0 8c-8 2-8 6 0 8l0 6'))
draw('binoculars.n.01', 'binokl',
     r(8, 28, 22, 32, 7), r(42, 28, 22, 32, 7), r(13, 16, 12, 12, 2), r(47, 16, 12, 12, 2), r(28, 32, 16, 8, 2),
     e(19, 52, 7, 4), e(53, 52, 7, 4))
draw('typewriter.n.01', 'yazı maşını',
     p('M10 62L16 36H56L62 62Z'), p('M24 32V8H48V32'), p('M28 14H44M28 19H42M28 24H40', stroke_width=1.2),
     r(12, 30, 48, 6, 3), *[c(x, y, 1.6) for y, xs in ((45, range(21, 54, 6)), (52, range(18, 57, 6))) for x in xs],
     p('M24 58H48'))
draw('sewing_machine.n.01', 'tikiş maşını',
     r(6, 54, 60, 8, 2), p('M14 54V22C14 16 18 14 24 14H54C58 14 60 16 60 20V36H54'), p('M54 36V44H60V36'),
     p('M57 44V52'), p('M30 14V8M26 8H34'), c(20, 28, 5), p('M24 54V44H50V54'))
draw('hand_blower.n.01', 'fen',
     p('M14 16H44C50 16 52 20 52 25C52 30 50 34 44 34H14C10 34 8 30 8 25C8 20 10 16 14 16Z'),
     p('M52 21H61V29H52'), p('M24 34L20 62H30L34 34'), p('M65 20h4M65 25h5M65 30h4'),
     p('M12 21V29M15 21V29', stroke_width=1.2))
draw('saltshaker.n.01', 'duzluq',
     p('M24 24C24 12 48 12 48 24Z'), p('M24 24H48L52 62H20Z'), c(32, 18, 1.2, True), c(36, 16, 1.2, True),
     c(40, 18, 1.2, True), p('M26 34H46', stroke_width=1.2))
draw('oar.n.01', 'avar', p('M10 62L42 30', stroke_width=3), e(53, 19, 17, 5, rot=-45), p('M10 62l-4 4', stroke_width=5))
draw('flag.n.01', 'bayraq',
     p('M14 8V64'), p('M8 64H20'), c(14, 6, 2),
     p('M14 11C24 5 32 17 42 13C50 9 56 11 60 13V37C52 33 46 35 38 39C30 43 22 35 14 37'))
draw('whistle.n.03', 'fit',
     p('M10 28H40C52 28 60 36 60 44C60 52 54 58 46 58C38 58 32 52 32 44V38H10Z'), p('M34 28L38 22H46L44 28'),
     c(46, 44, 4, True), p('M58 22l4-4M62 28h5'))
draw('drill.n.01', 'burğu',
     r(10, 18, 46, 20, 5), p('M56 24H62V32H56'), p('M62 28H70'), p('M64 26l2 4M67 26l2 4', stroke_width=1.2),
     p('M26 38L22 60H36L38 38'), p('M38 42h4'), r(18, 60, 22, 6, 1), p('M16 24H36', stroke_width=1.2))
draw('hosiery.n.01', 'şlanq',
     c(30, 40, 20), c(30, 40, 14), c(30, 40, 8), p('M50 40C58 40 62 32 62 24'), r(58, 12, 8, 12, 2),
     p('M60 9l-2-5M62 9V3M64 9l2-5'))
draw('horseshoe.n.01', 'nal',
     p('M16 12C8 30 10 54 36 60C62 54 64 30 56 12L48 14C54 30 52 48 36 52C20 48 18 30 24 14Z'),
     *[c(x, y, 1.4, True) for x, y in ((17, 24), (16, 36), (20, 47), (55, 24), (56, 36), (52, 47))])
draw('whip.n.01', 'şallaq',
     p('M10 64L24 46', stroke_width=5), p('M24 46C38 20 64 18 62 34C60 48 42 44 46 32C49 24 58 26 58 30'))

# ---------------------------------------------------------------- food
draw('pumpkin.n.01', 'boranı',
     p('M36 20C22 15 8 24 8 41C8 57 22 63 36 59C50 63 64 57 64 41C64 24 50 15 36 20Z'),
     p('M36 20C28 30 28 50 36 59M36 20C44 30 44 50 36 59M24 18C16 30 18 52 26 61M48 18C56 30 54 52 46 61'),
     p('M36 20C36 14 38 9 42 7'), leaf(39, 13, -20, 13, 4))
draw('walnut.n.01', 'qoz',
     p('M36 10C52 10 60 24 60 38C60 54 50 64 36 64C22 64 12 54 12 38C12 24 20 10 36 10Z'),
     p('M34 10C31 30 31 44 34 64M38 10C41 30 41 44 38 64', stroke_width=1.5),
     p('M18 28c4 2 6-2 10 0M44 24c4 2 6-2 10 0M16 42c4 2 6-2 10 0M46 42c4 2 6-2 10 0M22 54c3 2 5-1 8 0M42 54c3 1 5-2 8 0',
       stroke_width=1.5))
draw('plum.n.01', 'gavalı',
     p('M36 18C50 18 57 30 57 42C57 56 48 64 36 64C24 64 15 56 15 42C15 30 22 18 36 18Z'),
     p('M36 18C30 30 30 50 36 64', stroke_width=1.5), p('M24 32c-2 6-2 12 0 16', stroke_width=1.5),
     p('M36 18C36 12 38 8 41 6'))
draw('raspberry.n.01', 'moruq',
     *[c(x, y, 5) for y, xs in ((30, (28, 36, 44)), (39, (24, 32, 40, 48)), (48, (28, 36, 44)), (57, (32, 40))) for x in xs],
     p('M26 24L36 18L46 24M30 20L36 26L42 20'), p('M36 18V10'))
draw('almond.n.01', 'badam',
     g('rotate(-25 26 38)', p('M26 12C38 22 42 38 36 54C33 62 19 62 16 54C10 38 14 22 26 12Z'),
       p('M22 26c2 4 2 8 0 12M30 30c2 4 2 8 0 12M24 44c2 3 2 6 0 9', stroke_width=1.2)),
     g('rotate(20 50 40)', p('M50 16C61 25 65 39 59 53C56 60 44 60 41 53C35 39 39 25 50 16Z'),
       p('M47 28c2 4 2 8 0 12M54 34c2 4 2 8 0 12', stroke_width=1.2)))
draw('hazelnut.n.01', 'fındıq',
     p('M18 38C18 52 26 62 36 62C46 62 54 52 54 38Z'), p('M16 38C16 30 24 24 36 24C48 24 56 30 56 38Z'),
     p('M36 24V16'), p('M22 32l4 4M30 28l2 6M42 28l-2 6M50 32l-4 4', stroke_width=1.2))
draw('radish.n.01', 'turp',
     p('M36 28C48 28 54 38 50 48C46 56 38 60 36 66C34 60 26 56 22 48C18 38 24 28 36 28Z'), p('M36 66V70'),
     leaf(36, 28, -130, 20, 6), leaf(36, 28, -50, 20, 6), leaf(36, 28, -90, 18, 4))
draw('cauliflower.n.01', 'gülkələm',
     p('M14 38c-4-8 4-16 11-12c2-8 13-9 17-2c6-6 17-1 14 7c8 1 9 11 3 14'),
     p('M24 34c2-3 6-3 8 0M36 30c2-3 6-3 8 0M44 38c2-3 6-3 8 0M28 42c2-3 6-3 8 0', stroke_width=1.5),
     p('M10 38C12 50 24 60 36 62C48 60 60 50 62 40'), p('M10 38C20 44 26 54 30 62M62 40C54 46 46 54 42 62'))
draw('baklava.n.01', 'paxlava',
     p('M36 14L62 30L36 46L10 30Z'), p('M10 30V40L36 56L62 40V30'), p('M36 46V56'),
     p('M10 34L36 50L62 34M10 37L36 53L62 37', stroke_width=1.2), e(36, 30, 5, 3, fill=True))
draw('pilaf.n.01', 'plov',
     e(36, 54, 31, 9), p('M12 52C14 34 26 22 36 22C46 22 58 34 60 52'),
     *[p(f'M{x} {y}l2.5-1', stroke_width=1.5) for x, y in ((24, 40), (30, 33), (38, 30), (44, 38), (34, 44), (48, 46), (20, 48), (28, 50))],
     c(36, 24, 3, True), c(46, 30, 2.5, True), c(26, 30, 2.5, True))
draw('sausage.n.01', 'kolbasa',
     p('M14 24H50M14 44H50'), p('M14 24C6 24 6 44 14 44'), p('M8 34H4M4 31V37'), e(50, 34, 5, 10),
     c(49, 30, 1, True), c(51, 36, 1, True), c(48, 38, 1, True), e(60, 54, 6, 10),
     c(59, 50, 1, True), c(61, 56, 1, True), c(58, 58, 1, True))

# ---------------------------------------------------------------- animals
draw('stork.n.01', 'leylək',
     e(32, 30, 15, 8, rot=-12), p('M44 25C48 19 48 13 46 8'), c(47, 7, 3), p('M50 7L65 11L50 10'),
     p('M20 30L8 36L20 36Z', fill='currentColor'), p('M22 28C30 34 40 34 46 28'),
     p('M30 38V64M35 37L41 50L34 52'), p('M26 64H34'))
draw('pelican.n.01', 'qutan',
     p('M16 44C16 34 24 28 34 30C42 32 46 40 44 48C42 56 32 60 24 58C18 56 16 50 16 44Z'),
     p('M38 31C38 22 41 14 47 12'), c(50, 12, 5), p('M54 11L69 20'), p('M53 15C57 27 64 29 69 20'), c(49, 10, 1, True),
     p('M26 58V66M32 58V66M23 66H29M29 66H35'), p('M20 42C26 46 34 46 40 42'))
draw('gazelle.n.01', 'ceyran',
     p('M20 34C24 28 40 28 46 30C50 28 52 22 52 18'), p('M52 18L58 16L60 20L54 24'), c(55, 18, 0.8, True),
     p('M53 16C50 8 52 4 56 2M55 16C54 8 58 4 62 4'),
     p('M20 34C16 36 16 42 20 44C24 46 40 46 46 40C48 36 48 32 46 30'),
     p('M22 44L20 64M28 45L28 64M40 44L42 64M45 41L50 62'), p('M18 36L13 40'))
draw('walrus.n.01', 'morj',
     p('M16 34C16 20 26 12 36 12C46 12 56 20 56 34C56 44 50 50 36 50C22 50 16 44 16 34Z'),
     c(28, 26, 1.6, True), c(44, 26, 1.6, True),
     p('M24 40C24 34 36 34 36 40C36 34 48 34 48 40C48 46 36 46 36 42C36 46 24 46 24 40Z'),
     p('M30 44L28 64L32 64L33 46M42 44L44 64L40 64L39 46'), p('M10 66C12 56 18 52 24 50M62 66C60 56 54 52 48 50'),
     c(28, 40, 0.7, True), c(31, 38, 0.7, True), c(41, 38, 0.7, True), c(44, 40, 0.7, True))
draw('caterpillar.n.01', 'tırtıl',
     c(12, 50, 6), c(22, 44, 6.5), c(33, 41, 6.5), c(44, 42, 6.5), c(54, 38, 6.5), c(62, 30, 7),
     c(64, 28, 1.2, True), p('M60 23L56 14M65 23L68 14'), p('M12 56v4M22 50.5v6M33 47.5v6M44 48.5v6M54 44.5v6'))
draw('tadpole.n.01', 'çömçəquyruq',
     c(22, 34, 10), c(18, 31, 1.6, True), p('M32 34C40 26 46 42 54 34C58 30 62 32 66 34'),
     waves(8, 56, 7, 8, 2), waves(16, 62, 5, 8, 2))
draw('mustache.n.01', 'bığ',
     p('M36 32C30 25 20 25 14 31C10 35 6 35 4 31C6 41 20 43 36 35C52 43 66 41 68 31C66 35 62 35 58 31C52 25 42 25 36 32Z',
       fill='currentColor'), p('M36 10V22c-3 2-3 4 0 5'))

# ---------------------------------------------------------------- buildings & transport
books = []
for y0, specs in ((26, ((14, 14), (19, 12), (24, 15), (29, 13), (34, 15), (39, 11), (44, 14), (49, 13), (54, 15))),
                  (44, ((14, 13), (19, 15), (24, 12), (29, 14), (34, 15), (39, 13), (44, 15), (49, 12), (54, 14))),
                  (62, ((14, 15), (19, 13), (24, 14), (29, 12), (34, 15), (39, 14), (44, 13), (49, 15), (54, 13)))):
    books += [r(x, y0 - h, 4, h) for x, h in specs]
draw('library.n.01', 'kitabxana', r(10, 8, 52, 56), p('M10 26H62M10 44H62'), *books)
draw('prison.n.01', 'həbsxana',
     r(14, 12, 44, 48, 2), p('M14 30H58'), p('M23 12V60M32 12V60M41 12V60M50 12V60', stroke_width=3),
     p('M4 8H14M58 8H68M4 64H68M4 20H10M62 20H68M4 40H10M62 40H68M4 52H10M62 52H68', stroke_width=1.2))
draw('skyscraper.n.01', 'göydələn',
     r(24, 16, 24, 50), r(28, 10, 16, 6), p('M36 2V10'), p('M8 66H64'),
     *[p(f'M28 {y}h4M34 {y}h4M40 {y}h4', stroke_width=1.5) for y in range(22, 62, 6)],
     r(8, 40, 14, 26), r(50, 32, 14, 34), p('M12 46h6M12 52h6M12 58h6M54 38h6M54 44h6M54 50h6M54 56h6', stroke_width=1.5))
draw('beacon.n.03', 'mayak',
     p('M28 60L32 22H40L44 60Z'), p('M30.5 48H41.5M31.5 36H40.5'), r(30, 14, 12, 8), p('M28 14L36 6L44 14Z'),
     p('M44 16L64 10M44 20L64 26M28 16L8 10M28 20L8 26'), p('M18 60H54'), waves(4, 66, 8))
draw('greenhouse.n.01', 'istixana',
     p('M8 60V36C8 20 20 12 36 12C52 12 64 20 64 36V60Z'), p('M22 60V17.5M36 60V12M50 60V17.5M8 40H64'),
     p('M4 60H68'), leaf(15, 60, -70, 9, 3), leaf(15, 60, -110, 9, 3), leaf(43, 60, -70, 9, 3), leaf(43, 60, -110, 9, 3),
     leaf(57, 60, -80, 8, 3))
draw('balcony.n.01', 'balkon',
     r(24, 8, 24, 36), p('M36 8V44'), c(33, 28, 1, True), c(39, 28, 1, True), r(10, 44, 52, 4),
     p('M10 30H62'), *[p(f'M{x} 30V44', stroke_width=1.5) for x in range(14, 62, 6)], p('M16 48L22 54H50L56 48'),
     p('M4 4V66M68 4V66', stroke_width=1.2))
draw('dome.n.01', 'qübbə',
     p('M14 38C14 22 24 13 36 13C48 13 58 22 58 38Z'), p('M36 13V5'), c(36, 4, 1.5),
     r(12, 38, 48, 8), *[p(f'M{x} 46V60') for x in range(16, 58, 8)], p('M10 60H62V64H10Z'))
draw('submarine.n.01', 'sualtı qayıq',
     p('M8 42C8 34 16 30 26 30H52C62 30 66 36 66 42C66 48 62 54 52 54H26C16 54 8 50 8 42Z'),
     r(30, 20, 14, 10, 2), p('M38 20V11H45'), c(22, 42, 2.5), c(32, 42, 2.5), c(42, 42, 2.5), c(52, 42, 2.5),
     p('M66 42L70 37M66 42L70 47'), c(16, 22, 2), c(12, 14, 1.5), c(20, 12, 1.2))
draw('raft.n.01', 'sal',
     r(8, 30, 56, 7, 3.5), r(8, 37, 56, 7, 3.5), r(8, 44, 56, 7, 3.5), p('M18 28V53M54 28V53', stroke_width=3),
     p('M36 30V8'), p('M38 10L56 22H38Z'), waves(2, 60, 9))
draw('baby_buggy.n.01', 'uşaq arabası',
     p('M14 34C14 20 26 12 38 12V34Z'), p('M14 34H56C56 44 48 50 36 50H26C20 50 14 44 14 34Z'),
     p('M56 34L62 22H68'), c(22, 58, 6), c(50, 58, 6), c(22, 58, 1.5, True), c(50, 58, 1.5, True))

# ---------------------------------------------------------------- music
def harp():
    neck = ((14, 12), (26, 4), (42, 24), (60, 16))
    board = lambda x: 62 - (x - 16) * (44 / 42)
    strings = []
    for t in (0.18, 0.3, 0.42, 0.54, 0.66, 0.78):
        x, y = bez(*neck, t)
        strings.append(p(f'M{n(x)} {n(y)}V{n(board(x))}', stroke_width=1.2))
    return [p('M14 12V62', stroke_width=4), p('M14 12C26 4 42 24 60 16'), p('M14 62L58 18'), *strings, p('M10 64H24')]


draw('harp.n.01', 'arfa', *harp())
bars = ''.join(r(10 + i * 8, 18 + i * 3, 6, 36 - i * 6, 1) for i in range(7))
draw('marimba.n.01', 'ksilofon', bars, p('M6 30H66M6 46H62', stroke_width=1.2), p('M30 64L50 50M44 66L56 52'),
     c(51, 49, 2.5, True), c(57, 51, 2.5, True))
draw('gramophone.n.01', 'qrammofon',
     r(10, 46, 36, 16, 1), e(28, 46, 16, 4), c(28, 45, 1.5, True), p('M42 46V36C42 32 44 30 48 30'),
     p('M47 31C52 24 54 14 52 5C60 6 68 13 67 22C62 26 56 29 50 33'), p('M14 62V66M42 62V66'))

# ---------------------------------------------------------------- shapes & small objects
draw('rectangle.n.01', 'düzbucaq', r(8, 20, 56, 32))
draw('hexagon.n.01', 'altıbucaqlı',
     pl(*[v for k in range(6) for v in (36 + 26 * math.cos(math.radians(60 * k)), 36 + 26 * math.sin(math.radians(60 * k)))], closed=True))
draw('octagon.n.01', 'səkkizbucaq',
     pl(*[v for k in range(8) for v in (36 + 27 * math.cos(math.radians(45 * k + 22.5)), 36 + 27 * math.sin(math.radians(45 * k + 22.5)))],
        closed=True))
draw('semicircle.n.01', 'yarımdairə', p('M8 48A28 28 0 0 1 64 48Z'))
draw('cylinder.n.01', 'silindr', e(36, 16, 20, 6), p('M16 16V56A20 6 0 0 0 56 56V16'), p('M16 56A20 6 0 0 1 56 56', stroke_dasharray='3 4'))
draw('pyramid.n.01', 'piramida', p('M36 8L6 56L44 64L66 46Z'), p('M36 8L44 64'), p('M6 56L66 46', stroke_dasharray='3 4'))
draw('cast.n.03', 'marka',
     r(14, 12, 44, 48, 0, stroke_width=4, stroke_dasharray='0 5'), r(21, 19, 30, 34),
     p('M21 46L31 34L38 41L43 36L51 46'), c(43, 27, 3))
draw('domino.n.02', 'domino',
     r(10, 10, 24, 46, 3), p('M10 33H34'), c(16, 16, 2, True), c(28, 27, 2, True), c(22, 22, 2, True),
     c(16, 40, 2, True), c(28, 40, 2, True), c(16, 49, 2, True), c(28, 49, 2, True),
     g('rotate(18 50 40)', r(38, 18, 24, 46, 3), p('M38 41H62'), c(50, 30, 2, True), c(44, 48, 2, True), c(56, 58, 2, True), c(50, 53, 2, True)))
draw('eraser.n.01', 'pozan',
     p('M12 38L36 22L60 34L36 50Z'), p('M12 38V46L36 58V50M36 58L60 42V34'), p('M24 30L48 42V50', stroke_width=1.5),
     p('M10 64H20M24 64h2M30 64h2', stroke_width=1.5), c(42, 62, 1, True), c(48, 64, 1, True))
draw('nail.n.01', 'mismar',
     g('rotate(30 36 36)', r(25, 6, 22, 5, 1.5), p('M33 11H39V54L36 64L33 54Z'), p('M33 15h6M33 18h6', stroke_width=1.2)))
draw('paper.n.01', 'kağız',
     p('M16 8H46L58 20V64H16Z'), p('M46 8V20H58'), p('M22 30H52M22 38H52M22 46H52M22 54H40', stroke_width=1.5))

# ---------------------------------------------------------------- actions
draw('sit.v.01', 'oturmaq',
     p('M30 44H54M32 44V64M52 44V64M54 44V20'),
     figure((40, 12), (44, 22, 46, 42, 28, 42, 26, 60, 20, 60), (44, 26, 34, 34, 30, 40)))
draw('read.v.01', 'oxumaq',
     c(36, 13, 7, fill=True), p('M22 46C22 30 50 30 50 46', stroke_width=4.5),
     p('M14 40L36 45L58 40V60L36 65L14 60Z'), p('M36 45V65'), p('M19 47l12 3M19 52l12 3M41 50l12-3M41 55l12-3', stroke_width=1.2))
draw('water.v.03', 'suvarmaq',
     p('M8 28H32V50C32 52 30 54 28 54H12C10 54 8 52 8 50Z'), p('M12 28C12 18 28 18 28 30'), p('M32 34L50 22'),
     r(49, 17, 5, 8, 1, transform='rotate(-34 51 21)'),
     p('M55 24l2 4M58 22l3 4M60 18l4 3', stroke_width=1.5), p('M60 32v3M56 38v3M63 40v3', stroke_width=1.5),
     p('M48 64H70'), p('M58 64V52'), leaf(58, 55, -150, 9, 3.5), leaf(58, 55, -30, 9, 3.5))
draw('jump.v.01', 'atlanmaq',
     figure((36, 9), (36, 17, 36, 36), (36, 22, 26, 12), (36, 22, 46, 12), (36, 36, 28, 44, 32, 52), (36, 36, 44, 44, 40, 52)),
     p('M14 64H58'), p('M22 58l-4 2M50 58l4 2', stroke_width=1.5), e(36, 64, 10, 1.5))
draw('push.v.01', 'itələmək',
     r(42, 26, 24, 34), figure((18, 16), (20, 24, 28, 40, 34, 52, 30, 62), (28, 40, 18, 52, 10, 62), (22, 28, 42, 32), (22, 30, 42, 42)),
     p('M4 64H70'), p('M44 22l4-4M58 22l4-4', stroke_width=1.2))
draw('transport.v.02', 'daşımaq',
     r(30, 20, 22, 18), figure((28, 10), (28, 19, 30, 40, 22, 52, 20, 62), (30, 40, 36, 52, 40, 62), (28, 23, 34, 38), (28, 23, 46, 38)),
     p('M4 64H70'), p('M8 34h8M6 40h8', stroke_width=1.5))
draw('dig.v.01', 'qazmaq',
     figure((24, 10), (26, 18, 30, 38, 22, 50, 20, 62), (30, 38, 38, 50, 40, 62), (26, 22, 38, 34), (26, 22, 42, 28)),
     p('M50 8L42 52', stroke_width=2.5), p('M36 52H48L46 62H38Z', fill='currentColor'), p('M50 8h6'),
     p('M4 64H68'), p('M50 64C52 56 60 54 68 56', fill='none'))
draw('throw.v.01', 'atmaq',
     figure((22, 18), (24, 26, 26, 44, 16, 54, 12, 64), (26, 44, 34, 54, 38, 64), (24, 30, 10, 24, 8, 14), (24, 30, 36, 30)),
     c(56, 16, 5), p('M38 26C44 18 48 16 51 16', stroke_dasharray='2 4'), p('M4 66H50'))
draw('kick.v.01', 'təpik atmaq',
     figure((24, 10), (26, 18, 28, 38, 22, 50, 20, 62), (28, 38, 42, 44, 50, 48), (26, 22, 14, 30), (26, 22, 38, 28)),
     c(58, 50, 7), p('M58 43l-4 5h8l-4-5M51 50h14M54 56l4-6l4 6', stroke_width=1.2), p('M4 64H40'))
draw('paint.v.01', 'rəngləmək',
     r(10, 10, 36, 52, 0, stroke_width=1.2), p('M10 16H30V62H10Z', fill='currentColor'),
     r(28, 12, 10, 24, 3), p('M38 24H48V44H40V58', stroke_width=2.5), r(37, 58, 6, 10, 2))
draw('listen.v.01', 'dinləmək',
     p('M22 62V50C14 46 10 38 10 28C10 16 20 8 32 8C44 8 52 16 52 28C52 34 50 38 54 44L50 46V52C50 56 46 58 42 56L38 56V62'),
     p('M40 24C40 18 34 16 30 20C26 24 30 30 34 30C34 34 30 38 28 40'),
     p('M58 20C62 24 62 32 58 36M63 14C69 22 69 34 63 42'))
draw('fall.v.01', 'düşmək',
     figure((52, 46), (46, 42, 30, 36), (30, 36, 20, 24, 12, 22), (30, 36, 18, 40, 10, 34), (44, 40, 52, 30), (44, 40, 56, 54)),
     p('M4 60H68'), p('M26 18l-4-6M34 16l2-7M18 30l-7-2', stroke_width=1.5), c(60, 18, 3), c(64, 10, 2))
# ---------------------------------------------------------------- batch 2
draw('puppet.n.01', 'marionet',
     p('M18 8H54', stroke_width=3), p('M36 4V16', stroke_width=3),
     p('M20 8L23 30M52 8L49 30M36 16V21M26 8L31 62M46 8L41 62', stroke_width=1),
     figure((36, 26), (36, 31, 36, 46), (36, 35, 29, 34, 23, 30), (36, 35, 43, 34, 49, 30), (36, 46, 33, 54, 31, 62), (36, 46, 39, 54, 41, 62)))
draw('fireplace.n.01', 'buxarı',
     r(4, 10, 64, 6, 1), p('M8 16V64M64 16V64'), p('M20 64V38C20 30 52 30 52 38V64'),
     p('M30 60C26 52 32 48 31 40C37 45 40 52 37 60Z'), p('M38 60C36 54 41 51 41 46C46 50 47 56 44 60Z'),
     p('M23 62L49 58M23 58L49 62', stroke_width=2.5),
     p('M8 28H20M52 28H64M8 42H20M52 42H64M8 54H20M52 54H64M14 16V28M58 16V28M14 42V54M58 42V54', stroke_width=1.2),
     p('M2 64H70'))
draw('torch.n.01', 'məşəl',
     p('M33 66L30 36H42L39 66Z'), p('M31.2 44H40.8M31.8 52H40.2', stroke_width=1.5), p('M25 30H47L43 36H29Z'),
     p('M36 4C44 12 49 19 46 25C44 29 28 29 26 25C23 19 28 11 36 4Z'), p('M36 14C40 18 41 22 39 25H33C31 22 32 18 36 14Z', fill='currentColor'))


def fern():
    curve = ((18, 66), (22, 46), (32, 24), (54, 8))
    parts = [p('M18 66C22 46 32 24 54 8')]
    steps = [0.12 + 0.08 * k for k in range(10)]
    for i, t in enumerate(steps):
        x, y = bez(*curve, t)
        x2, y2 = bez(*curve, min(t + 0.01, 1))
        ang = math.degrees(math.atan2(y2 - y, x2 - x))
        size = 13 - i * 0.9
        parts += [leaf(x, y, ang - 62, size, 2.6), leaf(x, y, ang + 62, size, 2.6)]
    return parts


draw('fern.n.01', 'qıjı', *fern())
draw('toothpaste.n.01', 'diş məcunu',
     p('M8 28L44 24C48 24 50 27 50 30V42C50 45 48 48 44 48L8 44Z'), p('M8 26V46', stroke_width=3),
     p('M13 27V45', stroke_width=1.2), r(20, 31, 18, 10, 1, stroke_width=1.2), p('M50 32H54V40H50'),
     p('M54 34C62 34 66 28 62 24C59 21 55 24 57 27'))
zip_closed = ''.join(r(30, y, 6, 2) + r(36, y + 2, 6, 2) for y in range(38, 66, 4))
zip_open = ''.join(p(f'M{n(30 - 8 * t)} {n(34 - 28 * t)}h3M{n(42 + 8 * t)} {n(34 - 28 * t)}h-3', stroke_width=2)
                   for t in (0.15, 0.32, 0.49, 0.66, 0.83))
draw('slide_fastener.n.01', 'zəncirbənd',
     p('M22 34L14 4M50 34L58 4M26 34V68M46 34V68'), p('M30 34L22 4M42 34L50 4', stroke_width=1.2), zip_closed, zip_open,
     r(28, 26, 16, 10, 2), r(32, 36, 8, 14, 3), c(36, 46, 1.4, True))
draw('aquarium.n.01', 'akvarium',
     r(8, 14, 56, 44, 3), p('M8 22H64', stroke_width=1.2), p('M6 58H66V64H6Z'),
     p('M22 38C26 32 36 32 40 38C36 44 26 44 22 38Z'), p('M22 38L16 33V43Z'), c(34, 37, 1, True),
     p('M52 58C48 50 56 44 52 36M57 58C59 50 55 46 59 40'), c(44, 30, 1.8), c(46, 25, 1.2), p('M12 58C14 54 18 54 20 58'))
draw('memorial.n.03', 'heykəl',
     p('M18 64H54V58H18Z'), p('M22 58V42H50V58'), p('M19 42H53'),
     figure((36, 10), (36, 17, 36, 30), (36, 21, 28, 28), (36, 21, 43, 13, 45, 6), (36, 30, 32, 40), (36, 30, 40, 40)),
     c(45.5, 4, 2))
draw('mortar.n.01', 'həvəng',
     p('M14 34H58C58 50 48 60 36 60C24 60 14 50 14 34Z'), p('M11 34H61'), p('M28 60L26 65H46L44 60'),
     p('M38 44L56 10', stroke_width=6), c(56.5, 9, 4, True))


def oasis():
    parts = [p('M2 56C16 46 30 46 44 56C52 50 62 50 70 54'), e(38, 60, 16, 3.5), waves(30, 60, 2, 6, 1.5),
             p('M24 55C25 44 23 36 21 28'), p('M48 55C47 46 49 38 52 31'), c(60, 14, 5)]
    for x, y in ((21, 28), (52, 31)):
        parts += [leaf(x, y, a, 12, 3) for a in (-160, -120, -60, -20, 30)]
    return parts


draw('haven.n.01', 'vahə', *oasis())
draw('slingshot.n.01', 'sapand',
     p('M36 66V42', stroke_width=5), p('M36 42L24 16M36 42L48 16', stroke_width=4),
     p('M24 16C26 30 46 30 48 16', stroke_width=1.5), c(36, 26, 3.5, True))
draw('beehive.n.04', 'arı pətəyi',
     p('M14 58C10 40 18 18 36 16C54 18 62 40 58 58Z'), p('M12.5 50H59.5M13.5 42H58.5M15.5 34H56.5M20 26H52', stroke_width=1.5),
     p('M30 58V53C30 48 42 48 42 53V58Z', fill='currentColor'), p('M8 58H64'),
     e(60, 10, 4, 2.6), leaf(59, 8, -120, 5, 2), leaf(61, 8, -60, 5, 2), p('M54 12C48 16 46 12 42 14', stroke_dasharray='1.5 3'))
draw('dumbbell.n.01', 'hantel',
     p('M22 36H50', stroke_width=4), r(10, 24, 8, 24, 2), r(54, 24, 8, 24, 2), r(18, 28, 4, 16, 1), r(50, 28, 4, 16, 1),
     p('M7 32V40M65 32V40'))
draw('seesaw.n.01', 'basqıncaq',
     p('M6 46L66 26', stroke_width=3), p('M28 62L36 37L44 62Z'), p('M14 43.6V36M58 28.4V20'), p('M4 62H68'),
     figure((10, 24), (10, 31, 10, 40)), figure((62, 10), (62, 17, 62, 26)))
draw('willow.n.01', 'söyüd',
     p('M36 66C34 56 37 46 34 34'), p('M10 40C10 20 22 10 36 10C50 10 62 20 62 40'),
     p('M14 28C11 40 12 50 14 58M20 20C17 36 18 48 20 56M28 14C26 32 27 44 28 52M44 14C46 32 45 44 44 52M52 20C55 36 54 48 52 56M58 28C61 40 60 50 58 58',
       stroke_width=1.5), p('M34 40L26 30M35 46L44 34', stroke_width=1.5), p('M20 66H52'))
draw('drink.v.01', 'içmək',
     figure((26, 14), (27, 21, 29, 44), (29, 44, 24, 64), (29, 44, 34, 64), (28, 26, 40, 32, 42, 22)),
     g('rotate(-35 44 15)', r(39, 6, 10, 16, 1.5), p('M39.5 12H48.5', stroke_width=1.2)))
draw('samovar.n.01', 'samovar',
     p('M20 24C12 30 12 48 20 54H52C60 48 60 30 52 24Z'), p('M26 24V18H46V24'), p('M28 18C28 9 44 9 44 18'),
     p('M44 13L53 8'), c(36, 7, 1.8), p('M18 30C9 30 9 40 15 42M54 30C63 30 63 40 57 42'), p('M15 39H57', stroke_width=1.2),
     p('M36 46H25V52', stroke_width=2.5), p('M22 44H29', stroke_width=2), p('M26 54L22 62H50L46 54'), p('M18 62H54'),
     p('M22 62V66M50 62V66'))
draw('glue.n.01', 'yapışqan',
     r(22, 28, 28, 34, 4), p('M26 28L30 20H42L46 28'), p('M33 20L36 9L39 20'), p('M36 3c-2 3-2 5 0 5c2 0 2-2 0-5'),
     r(26, 38, 20, 14, 1, stroke_width=1.2))
draw('tape.n.01', 'skotç', c(30, 36, 20), c(30, 36, 9), p('M30 56H64L61 59L64 62H33'), p('M30 16C42 16 50 24 50 36', stroke_width=1.2))
draw('cart.n.01', 'araba',
     p('M8 24H50V42H8Z'), p('M8 30H50M8 36H50', stroke_width=1.2), p('M50 34L68 28'), c(26, 50, 11), c(26, 50, 2.5, True),
     p('M26 39V61M15 50H37M18 42L34 58M34 42L18 58', stroke_width=1.5), p('M2 62H70'))
draw('match.n.01', 'kibrit',
     r(6, 40, 40, 22, 2), p('M6 47H46', stroke_width=1.2), p('M10 50h4M17 50h4M24 50h4', stroke_width=1.2),
     p('M52 64L58 28', stroke_width=3), e(58.6, 24, 3.6, 4.6, fill=True, rot=10), p('M59 18C54 12 57 7 60 2C65 8 65 13 59 18Z'))
draw('igniter.n.01', 'alışqan',
     r(22, 30, 26, 34, 4), p('M22 30V24H48V30'), c(30, 20, 4), p('M30 16V24', stroke_width=1),
     p('M41 22C35 16 38 10 41 4C47 12 47 18 41 22Z'))
draw('brush.n.02', 'şotka',
     p('M10 34C10 26 18 22 36 22C54 22 62 26 62 34Z'), r(10, 34, 52, 6, 1), *[p(f'M{x} 40V52', stroke_width=1.5) for x in range(13, 61, 4)])

# ---------------------------------------------------------------- batch 3: Azerbaijani things and basics
def strings_neck(x0, x1, top, bottom, frets):
    return [p(f'M{x0} {bottom}V{top}M{x1} {bottom}V{top}'), *[p(f'M{x0} {y}H{x1}', stroke_width=1) for y in frets]]


draw('word:tar', 'tar',
     g('rotate(-28 36 36)',
       p('M36 64C24 64 22 52 28 46.5C24 41 27 34 36 34C45 34 48 41 44 46.5C50 52 48 64 36 64Z'), e(36, 55, 6.5, 5.5),
       p('M32.5 59h7'), *strings_neck(34, 38, 10, 34, (14, 18, 22, 26, 30)), r(32.5, 2, 7, 8, 1),
       p('M32.5 4.5h-3M32.5 7.5h-3M39.5 4.5h3M39.5 7.5h3')), category='things')
draw('word:saz', 'saz',
     g('rotate(-28 36 36)',
       p('M36 65C24 65 21 52 25 44C28 38 32 35 36 35C40 35 44 38 47 44C51 52 48 65 36 65Z'), c(36, 49, 2.2),
       p('M32 59h8'), *strings_neck(34, 38, 8, 35, (12, 16, 20, 24, 28, 32)), p('M34 8L33 2H39L38 8'),
       p('M33 4h-3M39 4h3M33 7h-3M39 7h3')), category='things')
draw('word:kamança', 'kamança',
     c(32, 40, 10), p('M24 40H40', stroke_width=1.2), p('M32 50V66', stroke_width=2.5), p('M30 30V9M34 30V9'),
     r(29, 3, 6, 7, 1), p('M29 5h-3M35 5h3M29 8h-3M35 8h3'), p('M30 46h4'),
     p('M46 8C52 24 56 44 58 64'), p('M50 8C55 24 59 44 61 64', stroke_width=1), p('M46 8h4M58 64h3'), category='things')
buta_small = lambda x, y, k: p(f'M{n(x)} {n(y + 5 * k)}c{n(-4 * k)} 0 {n(-5 * k)} {n(-5 * k)} {n(-2 * k)} {n(-8 * k)}'
                               f'c{n(1.5 * k)} {n(-2 * k)} {n(4 * k)} {n(-2 * k)} {n(4 * k)} {n(-5 * k)}'
                               f'c{n(2 * k)} {n(3 * k)} {n(3 * k)} {n(9 * k)} {n(-2 * k)} {n(13 * k)}Z', stroke_width=1.2)
draw('word:kəlağayı', 'kəlağayı',
     p('M6 16H66L36 60Z'), p('M14 21H58L36 52Z', stroke_width=1.2), buta_small(26, 28, 1), buta_small(38, 27, 1),
     buta_small(32, 38, 1), buta_small(44, 30, 0.8), *[p(f'M{n(6 + 30 * t)} {n(16 + 44 * t)}l-3 2', stroke_width=1.2) for t in (0.1, 0.25, 0.4, 0.55, 0.7, 0.85)],
     *[p(f'M{n(66 - 30 * t)} {n(16 + 44 * t)}l3 2', stroke_width=1.2) for t in (0.1, 0.25, 0.4, 0.55, 0.7, 0.85)], p('M36 60v5'),
     category='things')
curls = ''.join(p(f'M{x} {y}c2-3 5-3 5 0', stroke_width=1.5) for y in (26, 34, 42, 50) for x in ((22, 30, 38, 46) if y % 16 == 10 else (18, 26, 34, 42, 48)))
draw('word:papaq', 'papaq',
     p('M18 58V22C18 15 54 15 54 22V58C54 62 18 62 18 58Z'), e(36, 22, 18, 5), curls, p('M18 56C18 60 54 60 54 56', stroke_width=1.2),
     category='things')
draw('word:dolma', 'dolma',
     e(36, 54, 31, 9), *[g(f'rotate({a} {x} {y})', r(x - 13, y - 5, 26, 10, 5), p(f'M{x - 7} {y - 5}C{x - 5} {y} {x - 5} {y} {x - 7} {y + 5}M{x + 3} {y - 5}C{x + 5} {y} {x + 5} {y} {x + 3} {y + 5}', stroke_width=1.2))
                         for x, y, a in ((24, 48, -8), (48, 48, 8), (36, 36, 0))], category='food')
draw('word:səməni', 'səməni',
     p('M8 50H64L58 60H14Z'), *[p(f'M{x} 50C{x} {40 - h} {x + d} {30 - h} {x + 2 * d} {18 - h}', stroke_width=1.5)
                                for x, h, d in ((14, -6, -1), (19, 0, 1), (24, 2, -1), (29, 6, 1), (34, 8, 0), (39, 6, -1), (44, 4, 1), (49, 2, -1), (54, -2, 1), (59, -6, 1))],
     p('M13 42H59M13 46H59', stroke_width=1.5), p('M36 44C30 36 24 40 30 44C24 48 30 52 36 44C42 36 48 40 42 44C48 48 42 52 36 44Z'),
     p('M34 46L30 56M38 46L42 56'), category='food')
draw('word:buta', 'buta',
     p('M30 64C14 60 10 42 20 30C28 20 40 18 46 10C48 5 55 5 55 11C55 17 49 19 47 23C57 31 59 49 49 59C43 65 36 66 30 64Z'),
     p('M32 56C22 53 20 42 26 35C31 29 38 28 42 24C50 32 51 45 44 52C40 56 36 57 32 56Z', stroke_width=1.2),
     c(35, 44, 4), c(35, 44, 1.2, True), c(51, 11, 1.5, True),
     *[c(36 + 13 * math.cos(a), 44 + 13 * math.sin(a), 0.9, True) for a in (0.6, 1.4, 2.2, 3.0, 3.8, 4.6, 5.4)], category='things')
draw('word:qaval', 'qaval',
     c(36, 36, 26), c(36, 36, 21), *[c(36 + 23.5 * math.cos(a), 36 + 23.5 * math.sin(a), 2.6) for a in (0.3, 1.35, 2.4, 3.45, 4.5, 5.55)],
     p('M28 30c2-4 6-4 8 0M38 40c2-4 6-4 8 0', stroke_width=1.2), category='things')
draw('word:qazan', 'qazan',
     p('M12 30H60V44C60 54 50 60 36 60C22 60 12 54 12 44Z'), p('M10 30H62'), p('M14 26C14 18 58 18 58 26Z'), c(36, 16, 2.5),
     p('M12 36C6 36 4 40 8 42M60 36C66 36 68 40 64 42'), p('M22 60L20 66M50 60L52 66'), category='things')
draw('cell.n.01', 'hüceyrə',
     p('M36 8C52 8 64 18 64 34C64 52 52 64 36 64C18 64 8 52 8 36C8 18 20 8 36 8Z'), c(38, 34, 10), c(40, 32, 3.5, True),
     e(20, 26, 4, 2.5, rot=30), e(22, 48, 5, 3, rot=-20), e(52, 50, 4, 2.5, rot=40), e(54, 22, 3.5, 2.2),
     p('M14 38c2-2 4 2 6 0M44 56c2-2 4 2 6 0M30 18c2-2 4 2 6 0', stroke_width=1.2), c(28, 56, 1.2, True), c(48, 16, 1.2, True))
draw('word:kök', 'kök',
     p('M4 30H68'), p('M36 30V14'), leaf(36, 18, -150, 12, 4), leaf(36, 14, -30, 12, 4),
     p('M36 30V48C36 54 34 58 30 62M36 40C30 42 24 46 18 56M36 44C42 46 48 52 52 62M36 36C44 38 52 42 58 50M36 50C38 54 40 58 40 66',
       stroke_width=1.5), p('M24 50l-3 1M47 52l3 0M30 58l-3 2', stroke_width=1.2))
draw('word:anemometr', 'anemometr',
     p('M36 30V64'), p('M30 64H42'), c(36, 28, 2.5),
     *[p(f'M36 28L{n(36 + 20 * math.cos(a))} {n(28 + 9 * math.sin(a))}') for a in (math.radians(200), math.radians(340), math.radians(90))],
     *[e(36 + 22 * math.cos(a), 28 + 10 * math.sin(a), 5, 4) for a in (math.radians(200), math.radians(340), math.radians(90))],
     p('M8 12c4-3 8 3 12 0M50 8c4-3 8 3 12 0', stroke_width=1.5), category='things')

# ---------------------------------------------------------------- batch 4: body parts (with a pointer) and actions
def arrow(x0, y0, x1, y1):
    a = math.atan2(y1 - y0, x1 - x0)
    bx, by = x1 - 6 * math.cos(a), y1 - 6 * math.sin(a)
    px, py = -math.sin(a) * 3.2, math.cos(a) * 3.2
    return (p(f'M{n(x0)} {n(y0)}L{n(bx)} {n(by)}', stroke_width=1.8) +
            p(f'M{n(x1)} {n(y1)}L{n(bx + px)} {n(by + py)}L{n(bx - px)} {n(by - py)}Z', fill='currentColor', stroke_width=1))


def bust(brows=1.2):
    return [c(36, 22, 11), c(32, 22, 1.3, True), c(40, 22, 1.3, True), p('M36 24v3.5h-1.5', stroke_width=1.2),
            p('M33 29.5q3 2 6 0', stroke_width=1.2), p('M29 17.5q3-2.2 6 0M37 17.5q3-2.2 6 0', stroke_width=brows),
            p('M31 32.5V40M41 32.5V40'), p('M8 66C8 50 20 42 31 40M41 40C52 42 64 50 64 66')]


draw('neck.n.01', 'boyun', *bust(), arrow(64, 28, 44, 36), group='bust')
draw('shoulder.n.01', 'çiyin', *bust(), arrow(68, 30, 56, 45), group='bust')
draw('eyebrow.n.01', 'qaş', *bust(brows=3), arrow(64, 12, 45, 16), group='bust')
draw('chin.n.01', 'çənə', *bust(), arrow(60, 42, 40, 33.5), group='bust')
draw('thorax.n.02', 'sinə', *bust(), arrow(62, 62, 40, 54), group='bust')
leg = pl(30, 4, 40, 34, 34, 56, w=8) + pl(34, 57, 30, 62, 50, 62, w=7)
draw('knee.n.01', 'diz', leg, arrow(64, 22, 46, 33), group='leg')
draw('ankle.n.01', 'topuq', leg, arrow(60, 44, 39, 56), group='leg')
arm = pl(6, 14, 28, 44, 52, 30, w=8) + c(58, 26, 6, True)
draw('elbow.n.01', 'dirsək', arm, arrow(10, 64, 26, 50), group='arm')
draw('wrist.n.01', 'bilək', arm, arrow(64, 52, 52, 36), group='arm')
draw('give.v.01', 'vermək',
     pl(2, 46, 22, 42, w=6), pl(70, 46, 50, 42, w=6), r(22, 28, 28, 20, 2), p('M36 28V48M22 36H50', stroke_width=1.5),
     p('M36 28C30 20 26 26 36 28C46 26 42 20 36 28Z'), p('M22 16C30 8 42 8 50 16'), p('M50 16L44 15.5L48.5 11Z', fill='currentColor', stroke_width=1))
draw('driver.n.01', 'sürücü',
     p('M12 24V62H32', stroke_width=3), figure((24, 14), (24, 22, 26, 44, 44, 46, 46, 62), (25, 28, 38, 34, 44, 30)),
     c(50, 34, 12), c(50, 34, 2.5, True), p('M38 34H62M50 34V46', stroke_width=1.5))
draw('squat.v.01', 'çöməlmək',
     figure((30, 14), (30, 22, 28, 40, 44, 44, 42, 60), (28, 40, 40, 50, 38, 62), (30, 27, 46, 32), (30, 27, 48, 26)), p('M8 64H64'))
draw('dive.v.01', 'dalmaq',
     figure((40, 32), (44, 26, 56, 12), (56, 12, 62, 6), (56, 12, 66, 10), (43, 30, 34, 38), (43, 30, 36, 40)),
     waves(4, 52, 8), waves(8, 60, 7), p('M26 46l-4-4M32 44v-5M38 46l4-4', stroke_width=1.5))
draw('pour.v.01', 'tökmək',
     g('rotate(-40 22 24)', p('M12 14H30L28 40H14Z'), p('M30 20C36 20 36 30 29 31'), p('M12 14L8 10')),
     p('M12 22C14 34 20 42 22 50', stroke_width=1.5), p('M14 48H34L32 66H16Z'), p('M15 54H33', stroke_width=1.2))
draw('iron.n.01', 'ütü',
     p('M8 52H60C63 52 65 49 63 45L56 31C54 27 50 25 45 25H18C12 25 8 30 8 36Z'), p('M20 25C20 13 46 13 48 25'),
     p('M8 46H62', stroke_width=1.2), c(42, 38, 2.5), p('M18 60c2-3 0-5 2-8M28 60c2-3 0-5 2-8M38 60c2-3 0-5 2-8', stroke_width=1.5))
draw('sow.v.01', 'əkmək',
     figure((22, 12), (22, 20, 24, 40, 18, 52, 16, 62), (24, 40, 30, 52, 32, 62), (22, 25, 36, 30, 42, 28), (22, 25, 12, 34)),
     c(46, 34, 1.2, True), c(50, 40, 1.2, True), c(47, 44, 1.2, True), c(53, 47, 1.2, True), c(49, 51, 1.2, True),
     p('M38 64H70M42 58q6-3 12 0M56 58q6-3 12 0', stroke_width=1.5))
draw('bite.v.01', 'dişləmək',
     p('M48 22C56 26 60 36 58 46C56 58 46 64 36 61C26 64 14 56 13 44C12 30 22 20 34 22C38 23 40 24 42 24'),
     p('M48 22C44 26 46 30 50 31C46 35 49 40 53 40C50 44 52 48 57 49'), p('M36 22C36 16 38 12 42 10'),
     leaf(40, 14, -20, 12, 3.5))

# ---------------------------------------------------------------- batch 5
draw('perfume.n.02', 'ətriyyat',
     r(18, 30, 30, 32, 6), p('M28 30V22H38V30'), r(26, 16, 14, 6, 1.5), p('M40 19H48'), p('M48 19C56 19 60 24 58 30C56 36 50 34 50 30'),
     p('M10 14l-4-3M10 20H4M12 8l-2-5', stroke_width=1.5), p('M24 40H42', stroke_width=1.2))
draw('throne.n.01', 'taxt-tac',
     p('M18 38V12L24 18L30 8L36 16L42 8L48 18L54 12V38'), r(12, 38, 48, 8, 2), p('M14 46V64M58 46V64M18 46V58M54 46V58'),
     p('M10 32V46M62 32V46', stroke_width=3), c(36, 26, 3, True), p('M24 26h4M44 26h4', stroke_width=1.5))
draw('vest.n.01', 'jilet',
     p('M24 8L36 22L48 8L58 14V56L50 62H38L36 58L34 62H22L14 56V14Z'), p('M36 22V58'),
     p('M24 8C24 16 20 22 14 24M48 8C48 16 52 22 58 24', stroke_width=1.5),
     c(36, 30, 1.4, True), c(36, 38, 1.4, True), c(36, 46, 1.4, True), p('M20 40h8M44 40h8', stroke_width=1.5))
draw('sack.n.01', 'kisə',
     p('M28 18C20 26 12 38 12 50C12 60 22 64 36 64C50 64 60 60 60 50C60 38 52 26 44 18'),
     p('M28 18C24 14 26 8 30 10C32 6 40 6 42 10C46 8 48 14 44 18'), p('M26 20C32 22 40 22 46 20', stroke_width=3),
     p('M22 40c4 4 4 12 0 16M50 40c-4 4-4 12 0 16', stroke_width=1.2))


if __name__ == '__main__':
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(D, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write('\n')
    print(len(D), 'drawings ->', OUT)
