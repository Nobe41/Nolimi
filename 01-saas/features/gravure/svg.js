// 01-saas/features/gravure/svg.js
// Parse SVG → courbes mathématiques (C/Q/A) + polygones pour punch.
// mesh.js extrude via THREE.Shape.bezierCurveTo (pas une polyline figée).

var GravureSvg = (function () {
    var WHITE_THR = 250;
    var FLATNESS = 0.12;

    function clampByte(v) {
        return Math.max(0, Math.min(255, Math.round(v)));
    }

    function parseColor(str) {
        if (!str) return null;
        var s = String(str).trim().toLowerCase();
        if (!s || s === 'none' || s === 'transparent') return null;
        if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 };
        if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };
        var hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            var h = hex[1];
            if (h.length === 3) {
                return {
                    r: parseInt(h[0] + h[0], 16),
                    g: parseInt(h[1] + h[1], 16),
                    b: parseInt(h[2] + h[2], 16),
                    a: 1
                };
            }
            return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16),
                a: 1
            };
        }
        var rgb = s.match(/^rgba?\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*\)$/);
        if (rgb) {
            return {
                r: clampByte(parseFloat(rgb[1])),
                g: clampByte(parseFloat(rgb[2])),
                b: clampByte(parseFloat(rgb[3])),
                a: rgb[4] != null ? parseFloat(rgb[4]) : 1
            };
        }
        return { r: 0, g: 0, b: 0, a: 1 };
    }

    function isWhiteColor(c, whiteThr) {
        var thr = whiteThr != null ? whiteThr : WHITE_THR;
        if (!c || c.a < 0.05) return true;
        return c.r >= thr && c.g >= thr && c.b >= thr;
    }

    // Encre = noir / sombre (pas le fond blanc)
    function isInkColor(c) {
        if (!c || c.a < 0.05) return false;
        if (isWhiteColor(c)) return false;
        var lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        return lum <= 160;
    }

    function shouldExtrudePaint(paint) {
        return isInkColor(parseColor(paint));
    }

    function getAttr(el, name) {
        if (!el || !el.getAttribute) return null;
        var v = el.getAttribute(name);
        return v != null && v !== '' ? v : null;
    }

    function paintFromStyle(style, prop) {
        if (!style) return null;
        var re = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i');
        var m = style.match(re);
        return m ? m[1].trim() : null;
    }

    function getFill(el, inherited) {
        var fromStyle = paintFromStyle(getAttr(el, 'style'), 'fill');
        if (fromStyle != null) return fromStyle;
        var fill = getAttr(el, 'fill');
        if (fill != null) return fill;
        return inherited != null ? inherited : '#000000';
    }

    function getStroke(el, inherited) {
        var fromStyle = paintFromStyle(getAttr(el, 'style'), 'stroke');
        if (fromStyle != null) return fromStyle;
        var stroke = getAttr(el, 'stroke');
        if (stroke != null) return stroke;
        return inherited != null ? inherited : 'none';
    }

    function isNonePaint(paint) {
        if (!paint) return true;
        var s = String(paint).trim().toLowerCase();
        return !s || s === 'none' || s === 'transparent';
    }

    function multiplyMatrix(a, b) {
        return [
            a[0] * b[0] + a[2] * b[1],
            a[1] * b[0] + a[3] * b[1],
            a[0] * b[2] + a[2] * b[3],
            a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4],
            a[1] * b[4] + a[3] * b[5] + a[5]
        ];
    }

    function parseTransform(str) {
        var m = [1, 0, 0, 1, 0, 0];
        if (!str) return m;
        var re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gi;
        var match;
        while ((match = re.exec(str))) {
            var type = match[1].toLowerCase();
            var nums = match[2].trim().split(/[\s,]+/).map(parseFloat).filter(function (n) { return isFinite(n); });
            var t = [1, 0, 0, 1, 0, 0];
            if (type === 'matrix' && nums.length >= 6) {
                t = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
            } else if (type === 'translate') {
                t = [1, 0, 0, 1, nums[0] || 0, nums[1] || 0];
            } else if (type === 'scale') {
                var sx = nums[0] != null ? nums[0] : 1;
                var sy = nums[1] != null ? nums[1] : sx;
                t = [sx, 0, 0, sy, 0, 0];
            } else if (type === 'rotate') {
                var ang = ((nums[0] || 0) * Math.PI) / 180;
                var c = Math.cos(ang);
                var s = Math.sin(ang);
                var cx = nums[1] || 0;
                var cy = nums[2] || 0;
                t = multiplyMatrix([1, 0, 0, 1, cx, cy], multiplyMatrix([c, s, -s, c, 0, 0], [1, 0, 0, 1, -cx, -cy]));
            }
            m = multiplyMatrix(m, t);
        }
        return m;
    }

    function applyMatrix(m, x, y) {
        return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
    }

    function dist2(a, b) {
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    function pushPoint(out, p, eps2) {
        if (!out.length || dist2(out[out.length - 1], p) > eps2) out.push({ x: p.x, y: p.y });
    }

    function cubicFlatness(p0, p1, p2, p3) {
        var ux = 3 * p1.x - 2 * p0.x - p3.x;
        var uy = 3 * p1.y - 2 * p0.y - p3.y;
        var vx = 3 * p2.x - p0.x - 2 * p3.x;
        var vy = 3 * p2.y - p0.y - 2 * p3.y;
        return Math.max(ux * ux + uy * uy, vx * vx + vy * vy);
    }

    function subdivCubic(p0, p1, p2, p3, tol2, out, eps2) {
        if (cubicFlatness(p0, p1, p2, p3) <= tol2) {
            pushPoint(out, p3, eps2);
            return;
        }
        var p01 = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
        var p12 = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
        var p23 = { x: (p2.x + p3.x) * 0.5, y: (p2.y + p3.y) * 0.5 };
        var p012 = { x: (p01.x + p12.x) * 0.5, y: (p01.y + p12.y) * 0.5 };
        var p123 = { x: (p12.x + p23.x) * 0.5, y: (p12.y + p23.y) * 0.5 };
        var p0123 = { x: (p012.x + p123.x) * 0.5, y: (p012.y + p123.y) * 0.5 };
        subdivCubic(p0, p01, p012, p0123, tol2, out, eps2);
        subdivCubic(p0123, p123, p23, p3, tol2, out, eps2);
    }

    function subdivQuad(p0, p1, p2, tol2, out, eps2) {
        var mx = (p0.x + 2 * p1.x + p2.x) * 0.25;
        var my = (p0.y + 2 * p1.y + p2.y) * 0.25;
        var lx = (p0.x + p2.x) * 0.5;
        var ly = (p0.y + p2.y) * 0.5;
        var dx = mx - lx;
        var dy = my - ly;
        if (dx * dx + dy * dy <= tol2) {
            pushPoint(out, p2, eps2);
            return;
        }
        var p01 = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
        var p12 = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
        var p012 = { x: (p01.x + p12.x) * 0.5, y: (p01.y + p12.y) * 0.5 };
        subdivQuad(p0, p01, p012, tol2, out, eps2);
        subdivQuad(p012, p12, p2, tol2, out, eps2);
    }

    function arcToPoints(p0, rx, ry, xAxisRot, largeArc, sweep, p1, tol2, out, eps2) {
        rx = Math.abs(rx);
        ry = Math.abs(ry);
        if (rx < 1e-6 || ry < 1e-6) {
            pushPoint(out, p1, eps2);
            return;
        }
        var phi = (xAxisRot * Math.PI) / 180;
        var cosPhi = Math.cos(phi);
        var sinPhi = Math.sin(phi);
        var dx = (p0.x - p1.x) / 2;
        var dy = (p0.y - p1.y) / 2;
        var x1p = cosPhi * dx + sinPhi * dy;
        var y1p = -sinPhi * dx + cosPhi * dy;
        var rx2 = rx * rx;
        var ry2 = ry * ry;
        var x1p2 = x1p * x1p;
        var y1p2 = y1p * y1p;
        var lam = x1p2 / rx2 + y1p2 / ry2;
        if (lam > 1) {
            var s = Math.sqrt(lam);
            rx *= s;
            ry *= s;
            rx2 = rx * rx;
            ry2 = ry * ry;
        }
        var sign = (largeArc === sweep) ? -1 : 1;
        var num = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2;
        var den = rx2 * y1p2 + ry2 * x1p2;
        var cPrime = den > 1e-12 ? sign * Math.sqrt(Math.max(0, num / den)) : 0;
        var cxp = cPrime * (rx * y1p) / ry;
        var cyp = cPrime * (-ry * x1p) / rx;
        var cx = cosPhi * cxp - sinPhi * cyp + (p0.x + p1.x) / 2;
        var cy = sinPhi * cxp + cosPhi * cyp + (p0.y + p1.y) / 2;

        function angle(u, v) {
            var n = Math.sqrt((u.x * u.x + u.y * u.y) * (v.x * v.x + v.y * v.y));
            if (n < 1e-12) return 0;
            var a = Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / n)));
            return u.x * v.y - u.y * v.x < 0 ? -a : a;
        }

        var v1 = { x: (x1p - cxp) / rx, y: (y1p - cyp) / ry };
        var v2 = { x: (-x1p - cxp) / rx, y: (-y1p - cyp) / ry };
        var theta1 = angle({ x: 1, y: 0 }, v1);
        var dTheta = angle(v1, v2);
        if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
        if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
        var steps = Math.max(4, Math.ceil(Math.abs(dTheta) / (Math.PI / 12)));
        for (var i = 1; i <= steps; i++) {
            var t = theta1 + (dTheta * i) / steps;
            var x = cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi;
            var y = cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi;
            pushPoint(out, { x: x, y: y }, eps2);
        }
    }

    function tokenizePath(d) {
        var tokens = [];
        var re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
        var m;
        while ((m = re.exec(d))) {
            if (m[1]) tokens.push({ cmd: m[1] });
            else tokens.push({ num: parseFloat(m[2]) });
        }
        return tokens;
    }

    function pathToSubpaths(d, flatness) {
        var tokens = tokenizePath(d || '');
        var i = 0;
        var subpaths = [];
        var current = [];
        var cx = 0, cy = 0, sx = 0, sy = 0;
        var lastC = null;
        var lastQ = null;
        var tol2 = flatness * flatness;
        var eps2 = (flatness * 0.15) * (flatness * 0.15);

        function readNum() {
            if (i >= tokens.length || tokens[i].cmd) return 0;
            return tokens[i++].num;
        }
        function hasNum() {
            return i < tokens.length && tokens[i].num != null;
        }
        function closeCurrent() {
            if (current.length >= 3) {
                var first = current[0];
                var last = current[current.length - 1];
                if (dist2(first, last) > eps2) current.push({ x: first.x, y: first.y });
                subpaths.push(current);
            }
            current = [];
        }

        while (i < tokens.length) {
            if (!tokens[i].cmd) { i++; continue; }
            var cmd = tokens[i++].cmd;
            var rel = cmd === cmd.toLowerCase();
            var c = cmd.toUpperCase();

            if (c === 'Z') {
                pushPoint(current, { x: sx, y: sy }, eps2);
                cx = sx; cy = sy;
                closeCurrent();
                lastC = null; lastQ = null;
                continue;
            }

            do {
                if (c === 'M') {
                    var mx = readNum(), my = readNum();
                    if (rel) { mx += cx; my += cy; }
                    closeCurrent();
                    cx = mx; cy = my; sx = mx; sy = my;
                    current = [{ x: cx, y: cy }];
                    lastC = null; lastQ = null;
                    c = 'L';
                } else if (c === 'L') {
                    var lx = readNum(), ly = readNum();
                    if (rel) { lx += cx; ly += cy; }
                    cx = lx; cy = ly;
                    pushPoint(current, { x: cx, y: cy }, eps2);
                    lastC = null; lastQ = null;
                } else if (c === 'H') {
                    var hx = readNum();
                    if (rel) hx += cx;
                    cx = hx;
                    pushPoint(current, { x: cx, y: cy }, eps2);
                    lastC = null; lastQ = null;
                } else if (c === 'V') {
                    var vy = readNum();
                    if (rel) vy += cy;
                    cy = vy;
                    pushPoint(current, { x: cx, y: cy }, eps2);
                    lastC = null; lastQ = null;
                } else if (c === 'C') {
                    var x1 = readNum(), y1 = readNum(), x2 = readNum(), y2 = readNum(), x = readNum(), y = readNum();
                    if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
                    var p0 = { x: cx, y: cy };
                    var p1 = { x: x1, y: y1 };
                    var p2 = { x: x2, y: y2 };
                    var p3 = { x: x, y: y };
                    subdivCubic(p0, p1, p2, p3, tol2, current, eps2);
                    lastC = { x: x2, y: y2 };
                    lastQ = null;
                    cx = x; cy = y;
                } else if (c === 'S') {
                    var sx2 = readNum(), sy2 = readNum(), sx3 = readNum(), sy3 = readNum();
                    if (rel) { sx2 += cx; sy2 += cy; sx3 += cx; sy3 += cy; }
                    var s0 = { x: cx, y: cy };
                    var s1 = lastC ? { x: 2 * cx - lastC.x, y: 2 * cy - lastC.y } : { x: cx, y: cy };
                    var s2 = { x: sx2, y: sy2 };
                    var s3 = { x: sx3, y: sy3 };
                    subdivCubic(s0, s1, s2, s3, tol2, current, eps2);
                    lastC = s2;
                    lastQ = null;
                    cx = sx3; cy = sy3;
                } else if (c === 'Q') {
                    var qx1 = readNum(), qy1 = readNum(), qx = readNum(), qy = readNum();
                    if (rel) { qx1 += cx; qy1 += cy; qx += cx; qy += cy; }
                    var q0 = { x: cx, y: cy };
                    var q1 = { x: qx1, y: qy1 };
                    var q2 = { x: qx, y: qy };
                    subdivQuad(q0, q1, q2, tol2, current, eps2);
                    lastQ = q1;
                    lastC = null;
                    cx = qx; cy = qy;
                } else if (c === 'T') {
                    var tx = readNum(), ty = readNum();
                    if (rel) { tx += cx; ty += cy; }
                    var t0 = { x: cx, y: cy };
                    var t1 = lastQ ? { x: 2 * cx - lastQ.x, y: 2 * cy - lastQ.y } : { x: cx, y: cy };
                    var t2 = { x: tx, y: ty };
                    subdivQuad(t0, t1, t2, tol2, current, eps2);
                    lastQ = t1;
                    lastC = null;
                    cx = tx; cy = ty;
                } else if (c === 'A') {
                    var arx = readNum(), ary = readNum(), arot = readNum(), large = readNum(), sweep = readNum(), ax = readNum(), ay = readNum();
                    if (rel) { ax += cx; ay += cy; }
                    arcToPoints({ x: cx, y: cy }, arx, ary, arot, !!large, !!sweep, { x: ax, y: ay }, tol2, current, eps2);
                    cx = ax; cy = ay;
                    lastC = null; lastQ = null;
                } else {
                    break;
                }
            } while (hasNum());
        }
        closeCurrent();
        return subpaths;
    }


    // Path SVG → sous-chemins de segments mathématiques (L/C/Q/A), sans tessellation
    function pathToCurveSubpaths(d) {
        var tokens = tokenizePath(d || '');
        var i = 0;
        var subpaths = [];
        var current = null;
        var cx = 0, cy = 0, sx = 0, sy = 0;
        var lastC = null;
        var lastQ = null;

        function readNum() {
            if (i >= tokens.length || tokens[i].cmd) return 0;
            return tokens[i++].num;
        }
        function hasNum() {
            return i < tokens.length && tokens[i].num != null;
        }
        function ensurePath() {
            if (!current) current = [];
        }
        function closeCurrent() {
            if (current && current.length) {
                current.push({ type: 'Z' });
                subpaths.push(current);
            }
            current = null;
        }

        while (i < tokens.length) {
            if (!tokens[i].cmd) { i++; continue; }
            var cmd = tokens[i++].cmd;
            var rel = cmd === cmd.toLowerCase();
            var c = cmd.toUpperCase();

            if (c === 'Z') {
                cx = sx; cy = sy;
                closeCurrent();
                lastC = null; lastQ = null;
                continue;
            }

            do {
                if (c === 'M') {
                    var mx = readNum(), my = readNum();
                    if (rel) { mx += cx; my += cy; }
                    closeCurrent();
                    cx = mx; cy = my; sx = mx; sy = my;
                    current = [{ type: 'M', p: { x: cx, y: cy } }];
                    lastC = null; lastQ = null;
                    c = 'L';
                } else if (c === 'L') {
                    var lx = readNum(), ly = readNum();
                    if (rel) { lx += cx; ly += cy; }
                    cx = lx; cy = ly;
                    ensurePath();
                    current.push({ type: 'L', p: { x: cx, y: cy } });
                    lastC = null; lastQ = null;
                } else if (c === 'H') {
                    var hx = readNum();
                    if (rel) hx += cx;
                    cx = hx;
                    ensurePath();
                    current.push({ type: 'L', p: { x: cx, y: cy } });
                    lastC = null; lastQ = null;
                } else if (c === 'V') {
                    var vy = readNum();
                    if (rel) vy += cy;
                    cy = vy;
                    ensurePath();
                    current.push({ type: 'L', p: { x: cx, y: cy } });
                    lastC = null; lastQ = null;
                } else if (c === 'C') {
                    var x1 = readNum(), y1 = readNum(), x2 = readNum(), y2 = readNum(), x = readNum(), y = readNum();
                    if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
                    ensurePath();
                    current.push({
                        type: 'C',
                        p1: { x: x1, y: y1 },
                        p2: { x: x2, y: y2 },
                        p: { x: x, y: y }
                    });
                    lastC = { x: x2, y: y2 };
                    lastQ = null;
                    cx = x; cy = y;
                } else if (c === 'S') {
                    var sx2 = readNum(), sy2 = readNum(), sx3 = readNum(), sy3 = readNum();
                    if (rel) { sx2 += cx; sy2 += cy; sx3 += cx; sy3 += cy; }
                    var s1 = lastC ? { x: 2 * cx - lastC.x, y: 2 * cy - lastC.y } : { x: cx, y: cy };
                    ensurePath();
                    current.push({
                        type: 'C',
                        p1: s1,
                        p2: { x: sx2, y: sy2 },
                        p: { x: sx3, y: sy3 }
                    });
                    lastC = { x: sx2, y: sy2 };
                    lastQ = null;
                    cx = sx3; cy = sy3;
                } else if (c === 'Q') {
                    var qx1 = readNum(), qy1 = readNum(), qx = readNum(), qy = readNum();
                    if (rel) { qx1 += cx; qy1 += cy; qx += cx; qy += cy; }
                    ensurePath();
                    current.push({
                        type: 'Q',
                        p1: { x: qx1, y: qy1 },
                        p: { x: qx, y: qy }
                    });
                    lastQ = { x: qx1, y: qy1 };
                    lastC = null;
                    cx = qx; cy = qy;
                } else if (c === 'T') {
                    var tx = readNum(), ty = readNum();
                    if (rel) { tx += cx; ty += cy; }
                    var t1 = lastQ ? { x: 2 * cx - lastQ.x, y: 2 * cy - lastQ.y } : { x: cx, y: cy };
                    ensurePath();
                    current.push({
                        type: 'Q',
                        p1: t1,
                        p: { x: tx, y: ty }
                    });
                    lastQ = t1;
                    lastC = null;
                    cx = tx; cy = ty;
                } else if (c === 'A') {
                    var arx = readNum(), ary = readNum(), arot = readNum(), large = readNum(), sweep = readNum(), ax = readNum(), ay = readNum();
                    if (rel) { ax += cx; ay += cy; }
                    ensurePath();
                    current.push({
                        type: 'A',
                        rx: arx, ry: ary, rot: arot,
                        large: !!large, sweep: !!sweep,
                        p: { x: ax, y: ay },
                        from: { x: cx, y: cy }
                    });
                    cx = ax; cy = ay;
                    lastC = null; lastQ = null;
                } else {
                    break;
                }
            } while (hasNum());
        }
        closeCurrent();
        return subpaths;
    }

    function transformCurveSubpath(subpath, m) {
        var out = [];
        for (var i = 0; i < subpath.length; i++) {
            var s = subpath[i];
            if (s.type === 'Z') { out.push({ type: 'Z' }); continue; }
            if (s.type === 'M' || s.type === 'L') {
                out.push({ type: s.type, p: applyMatrix(m, s.p.x, s.p.y) });
            } else if (s.type === 'C') {
                out.push({
                    type: 'C',
                    p1: applyMatrix(m, s.p1.x, s.p1.y),
                    p2: applyMatrix(m, s.p2.x, s.p2.y),
                    p: applyMatrix(m, s.p.x, s.p.y)
                });
            } else if (s.type === 'Q') {
                out.push({
                    type: 'Q',
                    p1: applyMatrix(m, s.p1.x, s.p1.y),
                    p: applyMatrix(m, s.p.x, s.p.y)
                });
            } else if (s.type === 'A') {
                // Arc sous transform : on conserve endpoints transformés + rayons scalés (approx)
                var sx = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
                var sy = Math.sqrt(m[2] * m[2] + m[3] * m[3]);
                out.push({
                    type: 'A',
                    rx: Math.abs(s.rx * sx),
                    ry: Math.abs(s.ry * sy),
                    rot: s.rot,
                    large: s.large,
                    sweep: s.sweep,
                    p: applyMatrix(m, s.p.x, s.p.y),
                    from: applyMatrix(m, s.from.x, s.from.y)
                });
            }
        }
        return out;
    }

    function sampleCurveSubpath(subpath, flatness) {
        var pts = [];
        var tol2 = flatness * flatness;
        var eps2 = (flatness * 0.15) * (flatness * 0.15);
        var cx = 0, cy = 0;
        for (var i = 0; i < subpath.length; i++) {
            var s = subpath[i];
            if (s.type === 'M') {
                cx = s.p.x; cy = s.p.y;
                pts = [{ x: cx, y: cy }];
            } else if (s.type === 'L') {
                cx = s.p.x; cy = s.p.y;
                pushPoint(pts, { x: cx, y: cy }, eps2);
            } else if (s.type === 'C') {
                var p0 = { x: cx, y: cy };
                subdivCubic(p0, s.p1, s.p2, s.p, tol2, pts, eps2);
                cx = s.p.x; cy = s.p.y;
            } else if (s.type === 'Q') {
                subdivQuad({ x: cx, y: cy }, s.p1, s.p, tol2, pts, eps2);
                cx = s.p.x; cy = s.p.y;
            } else if (s.type === 'A') {
                arcToPoints(s.from || { x: cx, y: cy }, s.rx, s.ry, s.rot, s.large, s.sweep, s.p, tol2, pts, eps2);
                cx = s.p.x; cy = s.p.y;
            } else if (s.type === 'Z') {
                if (pts.length) pushPoint(pts, { x: pts[0].x, y: pts[0].y }, eps2);
            }
        }
        return cleanClosedRing(pts);
    }

    function transformPoints(pts, m) {
        var out = [];
        for (var i = 0; i < pts.length; i++) out.push(applyMatrix(m, pts[i].x, pts[i].y));
        return out;
    }

    function rectToPoly(el) {
        var x = parseFloat(getAttr(el, 'x') || 0);
        var y = parseFloat(getAttr(el, 'y') || 0);
        var w = parseFloat(getAttr(el, 'width') || 0);
        var h = parseFloat(getAttr(el, 'height') || 0);
        if (!(w > 0 && h > 0)) return null;
        return [
            { x: x, y: y },
            { x: x + w, y: y },
            { x: x + w, y: y + h },
            { x: x, y: y + h },
            { x: x, y: y }
        ];
    }

    function circleToPoly(el, flatness) {
        var cx = parseFloat(getAttr(el, 'cx') || 0);
        var cy = parseFloat(getAttr(el, 'cy') || 0);
        var r = parseFloat(getAttr(el, 'r') || 0);
        if (!(r > 0)) return null;
        var steps = Math.max(48, Math.ceil((2 * Math.PI * r) / Math.max(flatness, 1e-4)));
        var pts = [];
        for (var i = 0; i <= steps; i++) {
            var a = (i / steps) * 2 * Math.PI;
            pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        return pts;
    }

    function ellipseToPoly(el, flatness) {
        var cx = parseFloat(getAttr(el, 'cx') || 0);
        var cy = parseFloat(getAttr(el, 'cy') || 0);
        var rx = parseFloat(getAttr(el, 'rx') || 0);
        var ry = parseFloat(getAttr(el, 'ry') || 0);
        if (!(rx > 0 && ry > 0)) return null;
        var steps = Math.max(48, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / Math.max(flatness, 1e-4)));
        var pts = [];
        for (var i = 0; i <= steps; i++) {
            var a = (i / steps) * 2 * Math.PI;
            pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
        }
        return pts;
    }

    function polygonAttrToPoly(el, close) {
        var raw = getAttr(el, 'points');
        if (!raw) return null;
        var nums = raw.trim().split(/[\s,]+/).map(parseFloat).filter(isFinite);
        if (nums.length < 6) return null;
        var pts = [];
        for (var i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
        if (close && pts.length) {
            var f = pts[0], l = pts[pts.length - 1];
            if (dist2(f, l) > 1e-8) pts.push({ x: f.x, y: f.y });
        }
        return pts.length >= 3 ? pts : null;
    }

    function rectToCurve(el) {
        var x = parseFloat(getAttr(el, 'x') || 0);
        var y = parseFloat(getAttr(el, 'y') || 0);
        var w = parseFloat(getAttr(el, 'width') || 0);
        var h = parseFloat(getAttr(el, 'height') || 0);
        if (!(w > 0 && h > 0)) return null;
        return [
            { type: 'M', p: { x: x, y: y } },
            { type: 'L', p: { x: x + w, y: y } },
            { type: 'L', p: { x: x + w, y: y + h } },
            { type: 'L', p: { x: x, y: y + h } },
            { type: 'Z' }
        ];
    }

    function circleToCurve(el) {
        var cx = parseFloat(getAttr(el, 'cx') || 0);
        var cy = parseFloat(getAttr(el, 'cy') || 0);
        var r = parseFloat(getAttr(el, 'r') || 0);
        if (!(r > 0)) return null;
        // Cercle = ellipse mathématique (conservée jusqu’au Shape Three)
        return [
            { type: 'M', p: { x: cx + r, y: cy } },
            { type: 'A', rx: r, ry: r, rot: 0, large: false, sweep: true, p: { x: cx - r, y: cy }, from: { x: cx + r, y: cy } },
            { type: 'A', rx: r, ry: r, rot: 0, large: false, sweep: true, p: { x: cx + r, y: cy }, from: { x: cx - r, y: cy } },
            { type: 'Z' }
        ];
    }

    function ellipseToCurve(el) {
        var cx = parseFloat(getAttr(el, 'cx') || 0);
        var cy = parseFloat(getAttr(el, 'cy') || 0);
        var rx = parseFloat(getAttr(el, 'rx') || 0);
        var ry = parseFloat(getAttr(el, 'ry') || 0);
        if (!(rx > 0 && ry > 0)) return null;
        return [
            { type: 'M', p: { x: cx + rx, y: cy } },
            { type: 'A', rx: rx, ry: ry, rot: 0, large: false, sweep: true, p: { x: cx - rx, y: cy }, from: { x: cx + rx, y: cy } },
            { type: 'A', rx: rx, ry: ry, rot: 0, large: false, sweep: true, p: { x: cx + rx, y: cy }, from: { x: cx - rx, y: cy } },
            { type: 'Z' }
        ];
    }

    function polygonToCurve(el, close) {
        var pts = polygonAttrToPoly(el, close);
        if (!pts || pts.length < 3) return null;
        var segs = [{ type: 'M', p: { x: pts[0].x, y: pts[0].y } }];
        for (var i = 1; i < pts.length; i++) {
            segs.push({ type: 'L', p: { x: pts[i].x, y: pts[i].y } });
        }
        if (close) segs.push({ type: 'Z' });
        return segs;
    }

    function collectFromElement(el, parentMat, flatness, outCurves, outPolys, inheritedFill, inheritedStroke) {
        if (!el || el.nodeType !== 1) return;
        var tag = (el.tagName || '').toLowerCase().replace(/^.*:/, '');
        if (tag === 'defs' || tag === 'clippath' || tag === 'mask' || tag === 'symbol' || tag === 'image') return;

        var local = parseTransform(getAttr(el, 'transform'));
        var mat = multiplyMatrix(parentMat, local);
        var fillHere = getFill(el, inheritedFill);
        var strokeHere = getStroke(el, inheritedStroke);

        if (tag === 'g' || tag === 'svg' || tag === 'a') {
            for (var c = el.firstChild; c; c = c.nextSibling) {
                collectFromElement(c, mat, flatness, outCurves, outPolys, fillHere, strokeHere);
            }
            return;
        }

        var inkFill = shouldExtrudePaint(fillHere);
        var inkStroke = isNonePaint(fillHere) && shouldExtrudePaint(strokeHere);
        if (!inkFill && !inkStroke) return;

        var curveSubs = [];
        if (tag === 'path') {
            curveSubs = pathToCurveSubpaths(getAttr(el, 'd') || '');
        } else if (tag === 'rect') {
            var rc = rectToCurve(el);
            if (rc) curveSubs = [rc];
        } else if (tag === 'circle') {
            var cc = circleToCurve(el);
            if (cc) curveSubs = [cc];
        } else if (tag === 'ellipse') {
            var ec = ellipseToCurve(el);
            if (ec) curveSubs = [ec];
        } else if (tag === 'polygon') {
            var pc = polygonToCurve(el, true);
            if (pc) curveSubs = [pc];
        } else if (tag === 'polyline') {
            var lc = polygonToCurve(el, true);
            if (lc) curveSubs = [lc];
        }

        for (var i = 0; i < curveSubs.length; i++) {
            var transformed = transformCurveSubpath(curveSubs[i], mat);
            if (!transformed.length) continue;
            outCurves.push(transformed);
            var ring = sampleCurveSubpath(transformed, flatness);
            if (ring.length >= 3) outPolys.push(ring);
        }
    }

    function parseViewBox(svgEl) {
        var vb = getAttr(svgEl, 'viewBox');
        if (vb) {
            var p = vb.trim().split(/[\s,]+/).map(parseFloat);
            if (p.length >= 4 && isFinite(p[2]) && p[2] > 0 && isFinite(p[3]) && p[3] > 0) {
                return { minX: p[0] || 0, minY: p[1] || 0, width: p[2], height: p[3] };
            }
        }
        var w = parseFloat(getAttr(svgEl, 'width') || 0);
        var h = parseFloat(getAttr(svgEl, 'height') || 0);
        if (w > 0 && h > 0) return { minX: 0, minY: 0, width: w, height: h };
        return { minX: 0, minY: 0, width: 100, height: 100 };
    }

    function cleanClosedRing(poly) {
        var pts = [];
        for (var i = 0; i < poly.length; i++) {
            var p = poly[i];
            if (!pts.length || dist2(pts[pts.length - 1], p) > 1e-12) pts.push({ x: p.x, y: p.y });
        }
        if (pts.length >= 2 && dist2(pts[0], pts[pts.length - 1]) < 1e-12) pts.pop();
        return pts;
    }

    // svgText → courbes mathématiques + polygones échantillonnés (punch)
    function parse(svgText, options) {
        options = options || {};
        var flatFrac = options.flatnessFrac != null ? options.flatnessFrac : 0.00055;
        var minFlat = options.minFlatness != null ? options.minFlatness : 0.025;
        if (!svgText || typeof DOMParser === 'undefined') return null;
        var doc;
        try {
            doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        } catch (e) {
            return null;
        }
        var svgEl = doc.querySelector('svg');
        if (!svgEl) return null;
        var vb = parseViewBox(svgEl);
        var adaptiveFlat = Math.max(minFlat, Math.min(vb.width, vb.height) * flatFrac);
        adaptiveFlat = Math.min(adaptiveFlat, Math.min(vb.width, vb.height) * 0.0012);
        var curves = [];
        var polys = [];
        collectFromElement(svgEl, [1, 0, 0, 1, 0, 0], adaptiveFlat, curves, polys, '#000000', 'none');
        if (!curves.length && !polys.length) return null;

        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        function touch(pt) {
            if (!pt) return;
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        }
        for (var ci = 0; ci < curves.length; ci++) {
            for (var cj = 0; cj < curves[ci].length; cj++) {
                var s = curves[ci][cj];
                if (s.p) touch(s.p);
                if (s.p1) touch(s.p1);
                if (s.p2) touch(s.p2);
                if (s.from) touch(s.from);
            }
        }
        for (var pi = 0; pi < polys.length; pi++) {
            for (var pj = 0; pj < polys[pi].length; pj++) touch(polys[pi][pj]);
        }
        if (!(maxX > minX && maxY > minY)) {
            minX = vb.minX; minY = vb.minY; maxX = vb.minX + vb.width; maxY = vb.minY + vb.height;
        }

        return {
            width: maxX - minX,
            height: maxY - minY,
            minX: minX,
            minY: minY,
            curves: curves,
            polygons: polys
        };
    }

    function pointInPolygon(x, y, poly) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var xi = poly[i].x, yi = poly[i].y;
            var xj = poly[j].x, yj = poly[j].y;
            var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function pointInPolygons(x, y, polygons) {
        for (var i = 0; i < polygons.length; i++) {
            if (pointInPolygon(x, y, polygons[i])) return true;
        }
        return false;
    }

    return {
        parse: parse,
        pathToCurveSubpaths: pathToCurveSubpaths,
        sampleCurveSubpath: sampleCurveSubpath,
        pointInPolygons: pointInPolygons,
        FLATNESS: FLATNESS
    };
})();
