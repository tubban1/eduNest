/**
 * HumanWalk — 纯 JS 人物步行动画库
 * 无 CSS 关键帧，每帧用 JS 设置各段 transform，可换头、换身体、换四肢。
 *
 * 用法：
 *   const walker = HumanWalk.createWalker({ scale: 1, duration: 1.5, playing: true });
 *   container.appendChild(walker.root);
 *   // 换头 / 换身体 / 换四肢
 *   walker.slots.head.appendChild(myHeadEl);
 *   walker.slots.upperTorso.appendChild(myBodyEl);
 *   walker.slots.leftArm.appendChild(myLeftArmEl);  // 或替换整条肢体的子节点
 *   HumanWalk.setPlaying(walker, true);
 */
(function (global) {
    'use strict';

    const TAU = Math.PI * 2;
    const PHASES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

    function lerpKeyframes(phase, values) {
        if (phase <= 0) return values[0];
        if (phase >= 1) return values[8];
        let i = 0;
        while (i < 8 && PHASES[i + 1] < phase) i++;
        const t = (phase - PHASES[i]) / (PHASES[i + 1] - PHASES[i]);
        return values[i] + t * (values[i + 1] - values[i]);
    }

    const WALK_KEYFRAMES = {
        bodyBob:    [0, 1, 0, -0.55, 0, 1, 0, -0.55, 0],
        bodyRotate: 12.5,
        lowerTorsoRotate: [0, 2, 0, -1, 0, 2, 0, -1, 0],
        upperTorsoRotate: -10,
        upperArm:   [40, 50, 10, -5, -15, -25, 0, 20, 40],
        forearm:    [-5, -10, -5, -15, -35, -55, -30, -15, -5],
        hand:       [20, 40, 20, 5, -5, -15, -5, 5, 20],
        thigh:      [-40, -60, -5, 5, 20, 25, -15, -40, -40],
        shin:       [0, 45, 0, 0, 10, 30, 80, 60, 0],
        foot:       [-90, -100, -90, -75, -60, -65, -75, -80, -90],
        toe:        [0, 0, -10, -30, -60, -40, -20, 0, 0]
    };

    const DEFAULT_SIZES = {
        body: 64,
        torso: 64,
        lowerTorso: 32,
        upperTorso: 32,
        neck: 12,
        head: 32,
        upperArm: 56,
        forearm: 56,
        hand: 24,
        thigh: 72,
        shin: 72,
        foot: 28,
        toe: 18,
        joint: 16
    };

    function el(tag, attrs, children) {
        const e = document.createElement(tag);
        if (attrs) {
            for (const [k, v] of Object.entries(attrs)) {
                if (v == null) continue;
                if (k === 'className') e.className = v;
                else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
                else if (k === 'dataset') Object.assign(e.dataset, v);
                else if (k.startsWith('data-')) e.setAttribute(k, String(v));
                else e.setAttribute(k, String(v));
            }
        }
        if (children) children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
        return e;
    }

    function createSegment(name, baseLength, baseWidth, opts, calc, atEndOfParent) {
        const w = baseWidth != null ? baseWidth : DEFAULT_SIZES.joint;
        const L = baseLength != null ? baseLength : w;
        const seg = document.createElement('div');
        seg.className = 'hw-segment';
        seg.dataset.segment = name;
        seg.dataset.atEnd = atEndOfParent ? '1' : '0';
        seg.style.cssText = `
            position: absolute;
            left: ${atEndOfParent ? '50%' : '0'};
            top: ${atEndOfParent ? '100%' : '0'};
            width: ${calc(w)};
            height: ${calc(L)};
            transform-origin: ${calc(w / 2)} 0;
            box-sizing: border-box;
        `;
        if (atEndOfParent) seg.style.transform = 'translate(-50%, 0)';
        if (opts.background != null) seg.style.background = opts.background;
        if (opts.borderRadius != null) seg.style.borderRadius = opts.borderRadius;
        return seg;
    }

    function createSlot(name) {
        const slot = document.createElement('div');
        slot.className = 'hw-slot';
        slot.dataset.slot = name;
        slot.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none;';
        return slot;
    }

    function createJointEl(calc, j, position, name) {
        const isTop = position === 'top';
        const el = document.createElement('div');
        el.className = 'hw-joint';
        el.dataset.joint = name || '';
        el.style.cssText = `
            position: absolute;
            left: 50%;
            ${isTop ? 'top: 0;' : 'top: 100%;'}
            width: ${calc(j)};
            height: ${calc(j)};
            margin-left: ${calc(-j / 2)};
            margin-top: ${calc(-j / 2)};
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, #fff, #e8e8e8);
            border: 1px solid rgba(0,0,0,0.15);
            box-sizing: border-box;
            pointer-events: none;
        `;
        return el;
    }

    function buildWalkerDOM(sizes, scale, hue) {
        const base = (key) => sizes[key] != null ? sizes[key] : DEFAULT_SIZES[key];
        const s = (key) => base(key) * scale;
        const bg = (lighter) => `hsl(var(--hw-hue, 0), 50%, ${lighter ? 55 : 45}%)`;
        const bgInner = () => `hsl(var(--hw-hue, 0), 55%, 38%)`;
        const bgOuter = () => `hsl(var(--hw-hue, 0), 45%, 60%)`;
        const joint = s('joint');
        const calc = (v) => `calc(var(--hw-scale, 1) * ${v}px)`;

        const j = base('joint'), b = base('body'), t = base('torso'), h = base('head');
        const tLo = base('lowerTorso') != null ? base('lowerTorso') : t / 2;
        const tUp = base('upperTorso') != null ? base('upperTorso') : t / 2;
        const body = document.createElement('div');
        body.className = 'hw-body';
        body.dataset.segment = 'body';
        body.style.cssText = `
            position: relative;
            width: ${calc(j)};
            height: ${calc(b)};
            transform-origin: ${calc(j / 2)} 0;
        `;

        /* 与原始 popke 一致：上躯干在上（肩/头）、下躯干在下（腰/腿），子段挂在父段末端 */
        const upperTorso = createSegment('upperTorso', tUp, j, { background: bg(false), borderRadius: '50%' }, calc, false);
        upperTorso.style.zIndex = '1';
        body.appendChild(upperTorso);

        const bodySlot = createSlot('upperTorso');
        bodySlot.style.width = calc(j);
        bodySlot.style.height = calc(tUp);
        const defaultTorso = el('div', { style: { width: '100%', height: '100%', background: bg(false), borderRadius: j / 2 + 'px' } }, []);
        bodySlot.appendChild(defaultTorso);
        upperTorso.appendChild(bodySlot);

        const neckLen = base('neck');
        const neckSeg = createSegment('neck', neckLen, j, { background: bg(true), borderRadius: '50%' }, calc, false);
        neckSeg.style.top = calc(-neckLen);
        upperTorso.appendChild(neckSeg);
        upperTorso.appendChild(createJointEl(calc, j, 'top', 'neck'));
        const headSlot = createSlot('head');
        headSlot.style.width = calc(h * 1.5);
        headSlot.style.height = calc(h);
        headSlot.style.left = `calc(var(--hw-scale, 1) * ${(j - h * 1.5) / 2}px)`;
        headSlot.style.top = `calc(var(--hw-scale, 1) * -${h + neckLen}px)`;
        const defaultHead = el('div', {
            style: {
                width: '100%', height: '100%', borderRadius: '50%',
                background: bg(true), border: '2px solid rgba(0,0,0,0.2)'
            }
        }, []);
        headSlot.appendChild(defaultHead);
        upperTorso.appendChild(headSlot);

        function addArm(side) {
            const armRoot = document.createElement('div');
            armRoot.className = `hw-arm hw-${side}${side === 'left' ? ' hw-inner' : ''}`;
            armRoot.dataset.side = side;
            const jointW = base('joint');
            const armLeft = side === 'left' ? -jointW / 2 : (j - jointW / 2);
            const armZ = side === 'left' ? 0 : 2;
            const armShadow = side === 'left' ? '; box-shadow: inset 6px 0 12px rgba(0,0,0,0.25)' : '';
            armRoot.style.cssText = `position: absolute; left: ${calc(armLeft)}; top: 0; z-index: ${armZ}${armShadow};`;
            const limbBg = side === 'left' ? bgInner() : bgOuter();
            const upper = createSegment(`${side}UpperArm`, base('upperArm'), base('joint'), { background: limbBg, borderRadius: '50%' }, calc, false);
            const forearm = createSegment(`${side}Forearm`, base('forearm'), base('joint'), { background: limbBg, borderRadius: '50%' }, calc, true);
            const hand = createSegment(`${side}Hand`, base('hand'), base('joint') * 1.2, { background: limbBg, borderRadius: '50%' }, calc, true);
            upper.appendChild(forearm);
            upper.appendChild(createJointEl(calc, j, 'bottom', `elbow${side === 'left' ? 'Left' : 'Right'}`));
            forearm.appendChild(hand);
            forearm.appendChild(createJointEl(calc, j, 'bottom', `wrist${side === 'left' ? 'Left' : 'Right'}`));
            armRoot.appendChild(upper);
            armRoot.appendChild(createJointEl(calc, j, 'top', `shoulder${side === 'left' ? 'Left' : 'Right'}`));
            return { root: armRoot, upper, forearm, hand };
        }

        const leftArm = addArm('left');
        upperTorso.appendChild(leftArm.root);
        const rightArm = addArm('right');
        upperTorso.appendChild(rightArm.root);

        upperTorso.appendChild(createJointEl(calc, j, 'bottom', 'waist'));
        const lowerTorso = createSegment('lowerTorso', tLo, j, { background: bg(false), borderRadius: '50%' }, calc, true);
        lowerTorso.style.zIndex = '1';
        upperTorso.appendChild(lowerTorso);

        const lowerTorsoSlot = createSlot('lowerTorso');
        lowerTorsoSlot.style.width = calc(j);
        lowerTorsoSlot.style.height = calc(tLo);
        const defaultLowerTorso = el('div', { style: { width: '100%', height: '100%', background: bg(false), borderRadius: j / 2 + 'px' } }, []);
        lowerTorsoSlot.appendChild(defaultLowerTorso);
        lowerTorso.appendChild(lowerTorsoSlot);

        function addLeg(side) {
            const legRoot = document.createElement('div');
            legRoot.className = `hw-leg hw-${side}${side === 'left' ? ' hw-inner' : ''}`;
            legRoot.dataset.side = side;
            const jointW = base('joint');
            const legLeft = side === 'left' ? -jointW / 2 : (j - jointW / 2);
            const legZ = side === 'left' ? 0 : 2;
            const legShadow = side === 'left' ? '; box-shadow: inset 6px 0 12px rgba(0,0,0,0.25)' : '';
            legRoot.style.cssText = `position: absolute; left: ${calc(legLeft)}; top: 100%; z-index: ${legZ}${legShadow};`;
            const limbBg = side === 'left' ? bgInner() : bgOuter();
            const thigh = createSegment(`${side}Thigh`, base('thigh'), base('joint'), { background: limbBg, borderRadius: '50%' }, calc, false);
            const shin = createSegment(`${side}Shin`, base('shin'), base('joint'), { background: limbBg, borderRadius: '50%' }, calc, true);
            const foot = createSegment(`${side}Foot`, base('foot'), base('joint') * 1.2, { background: limbBg, borderRadius: '50%' }, calc, true);
            const toe = createSegment(`${side}Toe`, base('toe'), base('joint') * 1, { background: limbBg, borderRadius: '4px' }, calc, true);
            thigh.appendChild(shin);
            thigh.appendChild(createJointEl(calc, j, 'bottom', `knee${side === 'left' ? 'Left' : 'Right'}`));
            shin.appendChild(foot);
            shin.appendChild(createJointEl(calc, j, 'bottom', `ankle${side === 'left' ? 'Left' : 'Right'}`));
            foot.appendChild(toe);
            foot.appendChild(createJointEl(calc, j, 'bottom', `foot${side === 'left' ? 'Left' : 'Right'}`));
            toe.appendChild(createJointEl(calc, j, 'bottom', `toe${side === 'left' ? 'Left' : 'Right'}`));
            legRoot.appendChild(thigh);
            legRoot.appendChild(createJointEl(calc, j, 'top', `hip${side === 'left' ? 'Left' : 'Right'}`));
            return { root: legRoot, thigh, shin, foot, toe };
        }

        const leftLeg = addLeg('left');
        lowerTorso.appendChild(leftLeg.root);
        const rightLeg = addLeg('right');
        lowerTorso.appendChild(rightLeg.root);

        return {
            root: body,
            segments: {
                body,
                lowerTorso,
                upperTorso,
                neck: neckSeg,
                head: headSlot,
                leftUpperArm: leftArm.upper,
                leftForearm: leftArm.forearm,
                leftHand: leftArm.hand,
                rightUpperArm: rightArm.upper,
                rightForearm: rightArm.forearm,
                rightHand: rightArm.hand,
                leftThigh: leftLeg.thigh,
                leftShin: leftLeg.shin,
                leftFoot: leftLeg.foot,
                leftToe: leftLeg.toe,
                rightThigh: rightLeg.thigh,
                rightShin: rightLeg.shin,
                rightFoot: rightLeg.foot,
                rightToe: rightLeg.toe
            },
            slots: {
                head: headSlot,
                upperTorso: bodySlot,
                lowerTorso: lowerTorsoSlot,
                leftArm: leftArm.root,
                rightArm: rightArm.root,
                leftLeg: leftLeg.root,
                rightLeg: rightLeg.root
            }
        };
    }

    function segRotate(el, angle) {
        const prefix = el.dataset.atEnd === '1' ? 'translate(-50%, 0) ' : '';
        return `${prefix}rotate(${angle}deg)`;
    }

    function updateTransforms(walker, phase) {
        const K = WALK_KEYFRAMES;
        const seg = walker.segments;
        const leftPhase = (phase + 0.5) % 1;

        const bob = lerpKeyframes(phase, K.bodyBob);
        const bobPx = bob * 16 * walker.scale;
        seg.body.style.transform = `translateY(${bobPx}px) rotate(${K.bodyRotate}deg)`;
        seg.lowerTorso.style.transform = segRotate(seg.lowerTorso, lerpKeyframes(phase, K.lowerTorsoRotate));
        seg.upperTorso.style.transform = segRotate(seg.upperTorso, K.upperTorsoRotate);

        seg.leftUpperArm.style.transform = segRotate(seg.leftUpperArm, lerpKeyframes(leftPhase, K.upperArm));
        seg.leftForearm.style.transform = segRotate(seg.leftForearm, lerpKeyframes(leftPhase, K.forearm));
        seg.leftHand.style.transform = segRotate(seg.leftHand, lerpKeyframes(leftPhase, K.hand));
        seg.rightUpperArm.style.transform = segRotate(seg.rightUpperArm, lerpKeyframes(phase, K.upperArm));
        seg.rightForearm.style.transform = segRotate(seg.rightForearm, lerpKeyframes(phase, K.forearm));
        seg.rightHand.style.transform = segRotate(seg.rightHand, lerpKeyframes(phase, K.hand));

        seg.leftThigh.style.transform = segRotate(seg.leftThigh, lerpKeyframes(leftPhase, K.thigh));
        seg.leftShin.style.transform = segRotate(seg.leftShin, lerpKeyframes(leftPhase, K.shin));
        seg.leftFoot.style.transform = segRotate(seg.leftFoot, lerpKeyframes(leftPhase, K.foot));
        seg.leftToe.style.transform = segRotate(seg.leftToe, lerpKeyframes(leftPhase, K.toe));
        seg.rightThigh.style.transform = segRotate(seg.rightThigh, lerpKeyframes(phase, K.thigh));
        seg.rightShin.style.transform = segRotate(seg.rightShin, lerpKeyframes(phase, K.shin));
        seg.rightFoot.style.transform = segRotate(seg.rightFoot, lerpKeyframes(phase, K.foot));
        seg.rightToe.style.transform = segRotate(seg.rightToe, lerpKeyframes(phase, K.toe));
    }

    function tick(walker) {
        if (!walker.playing) return;
        const t = (performance.now() / 1000 - walker.startTime) / walker.duration;
        const phase = t % 1;
        updateTransforms(walker, phase);
        walker.rafId = requestAnimationFrame(() => tick(walker));
    }

    /**
     * 创建步行小人
     * @param {Object} options
     * @param {number} [options.scale=1]
     * @param {number} [options.color=0] 0–100 映射到色相 0–360
     * @param {number} [options.duration=1.5] 一步周期（秒）
     * @param {boolean} [options.playing=false]
     * @param {Object} [options.sizes] 覆盖各段长度 { body, torso, head, upperArm, ... }
     * @returns {{ root, slots, segments, playing, duration, scale, startTime, setPlaying, setDuration, setScale, setColor }}
     */
    function createWalker(options = {}) {
        const scale = options.scale != null ? options.scale : 1;
        const hue = (options.color != null ? options.color : 0) / 100 * 360;
        const duration = options.duration != null ? options.duration : 1.5;
        const playing = options.playing === true;
        const sizes = options.sizes || {};

        const { root, segments, slots } = buildWalkerDOM(sizes, scale, hue);

        const container = document.createElement('div');
        container.className = 'hw-walker';
        container.style.cssText = 'position: relative; display: inline-block;';
        container.style.setProperty('--hw-scale', String(scale));
        container.style.setProperty('--hw-hue', String(hue));
        container.appendChild(root);

        const walker = {
            root: container,
            slots,
            segments,
            playing: false,
            duration,
            scale,
            startTime: performance.now() / 1000,
            setPlaying(play) {
                this.playing = !!play;
                if (this.rafId != null) {
                    cancelAnimationFrame(this.rafId);
                    this.rafId = null;
                }
                if (this.playing) {
                    this.startTime = performance.now() / 1000;
                    tick(this);
                }
            },
            setDuration(sec) {
                this.duration = sec;
            },
            setScale(s) {
                this.scale = s;
                this.root.style.setProperty('--hw-scale', String(s));
            },
            setColor(color0to100) {
                this.root.style.setProperty('--hw-hue', String((color0to100 / 100) * 360));
            }
        };

        if (playing) walker.setPlaying(true);
        else updateTransforms(walker, 0);

        return walker;
    }

    function setPlaying(walker, playing) {
        if (walker && walker.setPlaying) walker.setPlaying(playing);
    }

    function setDuration(walker, sec) {
        if (walker && walker.setDuration) walker.setDuration(sec);
    }

    function setScale(walker, s) {
        if (walker && walker.setScale) walker.setScale(s);
    }

    function setColor(walker, color0to100) {
        if (walker && walker.setColor) walker.setColor(color0to100);
    }

    const HumanWalk = {
        createWalker,
        setPlaying,
        setDuration,
        setScale,
        setColor
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = HumanWalk;
    } else {
        global.HumanWalk = HumanWalk;
    }
})(typeof window !== 'undefined' ? window : this);
