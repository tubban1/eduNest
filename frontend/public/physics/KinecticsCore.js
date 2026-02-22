/**
 * KineticsCore — 轻量 2D 运动学引擎
 * 提供 Vec2、运动链与 FABRIK IK 求解，支持角度约束与弹性骨骼
 *
 * 五种链式结构：
 * 1. 单链         KinematicChain(ox, oy).addStaticBone(...).solveIK(tx, ty)
 * 2. 多链独立     new MultiChain(false).addChain(chain1).addChain(chain2).solveAll([t1,t2])
 * 3. 多链共根     new MultiChain(true).setOrigin(x,y).addChain(...).solveAll([...])
 * 4. 多链一体     new KinematicSkeleton().setSpine(spine).addLimb('leftArm', arm, pointIndex).solve({ limbTargets })
 * 5. 树状分叉     new TreeChain(ox,oy).addNode('root', len).addBranch('root', [a,b,c]).solveIK([t1,t2,...])
 */
const KineticsCore = (function () {
    'use strict';

    // ---------- Vec2：基础向量，含就地运算以减少 GC ----------
    class Vec2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }

        set(x, y) {
            this.x = x;
            this.y = y;
            return this;
        }

        copy(v) {
            this.x = v.x;
            this.y = v.y;
            return this;
        }

        clone() {
            return new Vec2(this.x, this.y);
        }

        static sub(v1, v2, out = null) {
            const o = out || new Vec2();
            o.x = v1.x - v2.x;
            o.y = v1.y - v2.y;
            return o;
        }

        static add(v1, v2, out = null) {
            const o = out || new Vec2();
            o.x = v1.x + v2.x;
            o.y = v1.y + v2.y;
            return o;
        }

        static mul(v, s, out = null) {
            const o = out || new Vec2();
            o.x = v.x * s;
            o.y = v.y * s;
            return o;
        }

        static dist(v1, v2) {
            const dx = v1.x - v2.x, dy = v1.y - v2.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        static distSq(v1, v2) {
            const dx = v1.x - v2.x, dy = v1.y - v2.y;
            return dx * dx + dy * dy;
        }

        static angle(v1, v2) {
            return Math.atan2(v2.y - v1.y, v2.x - v1.x);
        }

        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }

        lengthSq() {
            return this.x * this.x + this.y * this.y;
        }

        /** 就地归一化，返回 this；若长度为 0 则不变 */
        normalizeSelf() {
            const mag = Math.sqrt(this.x * this.x + this.y * this.y);
            if (mag > 1e-10) {
                this.x /= mag;
                this.y /= mag;
            }
            return this;
        }

        /** 返回新向量，不改变 this */
        normalize() {
            const mag = Math.sqrt(this.x * this.x + this.y * this.y);
            return mag > 1e-10 ? new Vec2(this.x / mag, this.y / mag) : new Vec2();
        }
    }

    const _dir = new Vec2();

    /**
     * 将角度限制在 [min, max] 内（弧度）
     */
    function clampAngle(angle, minA, maxA) {
        if (minA == null || maxA == null) return angle;
        while (angle > maxA) angle -= Math.PI * 2;
        while (angle < minA) angle += Math.PI * 2;
        if (angle > maxA) return maxA;
        if (angle < minA) return minA;
        return angle;
    }

    /**
     * 运动链：支持静态骨骼、弹性骨骼与角度约束，FABRIK IK 求解
     */
    class KinematicChain {
        constructor(originX, originY) {
            this.origin = new Vec2(originX, originY);
            this.bones = [];
            this.points = [this.origin.clone()];
            this.constraints = [];
            this._totalLength = 0;
        }

        /**
         * 添加刚性骨骼
         * @param {number} length 长度
         * @param {Object} constraint 可选 { min, max } 弧度，相对前一根骨骼
         */
        addStaticBone(length, constraint = null) {
            this.bones.push({ type: 'static', length });
            this.constraints.push(constraint);
            const last = this.points[this.points.length - 1];
            this.points.push(new Vec2(last.x + length, last.y));
            this._totalLength += length;
            return this;
        }

        /**
         * 添加弹性骨骼（长度在 [min, max] 内变化以逼近目标）
         * @param {number} prefLength 首选长度
         * @param {number} min 最小长度
         * @param {number} max 最大长度
         */
        addElasticBone(prefLength, min, max) {
            const lo = Math.min(min, max);
            const hi = Math.max(min, max);
            this.bones.push({ type: 'elastic', length: prefLength, min: lo, max: hi });
            this.constraints.push(null);
            const last = this.points[this.points.length - 1];
            this.points.push(new Vec2(last.x + prefLength, last.y));
            this._totalLength += prefLength;
            return this;
        }

        /**
         * FABRIK IK：将末端拉向目标，并应用角度约束与弹性长度
         * @param {number} targetX
         * @param {number} targetY
         * @param {Object} options { iterations, tolerance }
         * @returns {Vec2[]} 关节点数组
         */
        solveIK(targetX, targetY, options = {}) {
            const maxIter = options.iterations ?? 12;
            const tolSq = (options.tolerance ?? 1e-4) ** 2;
            const pts = this.points;
            const n = pts.length;
            if (n < 2) return pts;

            const ox = this.origin.x, oy = this.origin.y;

            for (let iter = 0; iter < maxIter; iter++) {
                // 若末端已足够接近目标则提前退出
                const last = pts[n - 1];
                const dx = targetX - last.x, dy = targetY - last.y;
                if (dx * dx + dy * dy <= tolSq) break;

                // Backward: 末端 -> 根
                last.x = targetX;
                last.y = targetY;
                for (let i = n - 2; i >= 0; i--) {
                    Vec2.sub(pts[i], pts[i + 1], _dir).normalizeSelf();
                    const b = this.bones[i];
                    let len = b.length;
                    if (b.type === 'elastic') {
                        len = Math.max(b.min, Math.min(b.max, len));
                    }
                    pts[i].x = pts[i + 1].x + _dir.x * len;
                    pts[i].y = pts[i + 1].y + _dir.y * len;
                }

                // Forward: 根 -> 末端，并应用约束
                pts[0].x = ox;
                pts[0].y = oy;
                for (let i = 0; i < n - 1; i++) {
                    Vec2.sub(pts[i + 1], pts[i], _dir).normalizeSelf();
                    const b = this.bones[i];
                    let len = b.length;
                    if (b.type === 'elastic') {
                        len = Math.max(b.min, Math.min(b.max, len));
                    }

                    // 角度约束：限制当前段相对前一段的角度
                    const con = this.constraints[i];
                    if (con && (con.min != null || con.max != null)) {
                        const curAngle = Math.atan2(_dir.y, _dir.x);
                        const prevAngle = i === 0 ? 0 : Math.atan2(
                            pts[i].y - pts[i - 1].y,
                            pts[i].x - pts[i - 1].x
                        );
                        const relMin = (con.min != null ? con.min : -Math.PI);
                        const relMax = (con.max != null ? con.max : Math.PI);
                        const wantAngle = clampAngle(curAngle, prevAngle + relMin, prevAngle + relMax);
                        _dir.x = Math.cos(wantAngle);
                        _dir.y = Math.sin(wantAngle);
                    }

                    pts[i + 1].x = pts[i].x + _dir.x * len;
                    pts[i + 1].y = pts[i].y + _dir.y * len;
                }
            }

            return pts;
        }

        /**
         * 仅用 FK 从当前关节角/长度更新 points（可用于无 IK 时的姿态）
         * 当前为占位：若后续扩展角度存储可在此根据角度重算 points
         */
        updateFK() {
            // 保持与 origin 一致；实际 FK 需根据各段角度递推
            this.points[0].copy(this.origin);
            return this.points;
        }

        /** 总长度（静态+弹性首选长度之和） */
        get totalLength() {
            return this._totalLength;
        }

        /** 设置根节点位置（不重建链） */
        setOrigin(x, y) {
            this.origin.x = x;
            this.origin.y = y;
            return this;
        }
    }

    // ---------- 多链独立 / 多链共根 ----------
    /**
     * MultiChain：多链容器
     * - 多链独立：每条链自己的 origin，互不影响
     * - 多链共根：所有链共用同一个根，setOrigin(x,y) 同步到所有链
     * @param {boolean} sharedRoot 是否共根（同一原点）
     */
    class MultiChain {
        constructor(sharedRoot = false) {
            this.chains = [];
            this.sharedRoot = sharedRoot;
            this._origin = sharedRoot ? new Vec2(0, 0) : null;
        }

        /**
         * 添加一条链。若为共根模式，该链的 origin 会改为共用根
         */
        addChain(chain) {
            if (this.sharedRoot && this._origin) {
                chain.origin.x = this._origin.x;
                chain.origin.y = this._origin.y;
                chain.origin = this._origin; // 直接引用，后续 setOrigin 即生效
            }
            this.chains.push(chain);
            return this;
        }

        /** 设置根位置（共根模式下同步到所有链） */
        setOrigin(x, y) {
            if (this._origin) this._origin.set(x, y);
            return this;
        }

        /** 多链独立时，设置第 i 条链的根 */
        setChainOrigin(i, x, y) {
            if (i >= 0 && i < this.chains.length) this.chains[i].setOrigin(x, y);
            return this;
        }

        /**
         * 批量求解 IK。targets 为数组，每项为 [x,y] 或 {x,y}，与 chains 一一对应
         */
        solveAll(targets, options = {}) {
            const len = Math.min(this.chains.length, targets.length);
            for (let i = 0; i < len; i++) {
                const t = targets[i];
                const x = Array.isArray(t) ? t[0] : t.x;
                const y = Array.isArray(t) ? t[1] : t.y;
                this.chains[i].solveIK(x, y, options);
            }
            return this.chains;
        }

        /** 返回所有链的末端点（最后关节点） */
        getEndpoints() {
            return this.chains.map(c => c.points[c.points.length - 1]);
        }
    }

    // ---------- 多链一体（人体型：脊柱 + 四肢，共享关节点） ----------
    /**
     * KinematicSkeleton：脊柱链 + 多条肢体链，肢体根挂在脊柱关节点上
     * 用法：setSpine(链) -> addLimb(id, 链, 附着点) -> solve(目标表)
     */
    class KinematicSkeleton {
        constructor(originX = 0, originY = 0) {
            this.origin = new Vec2(originX, originY);
            this.spine = null;           // KinematicChain，从根到胸/头
            this.limbs = {};            // id -> { chain, pointIndex, offsetX, offsetY }
            this.limbOrder = [];        // 保证顺序
        }

        /**
         * 设置脊柱链（一根从骨盆到胸/头的链）。其 origin 会与本 skeleton 的 origin 同步
         */
        setSpine(chain) {
            chain.origin.x = this.origin.x;
            chain.origin.y = this.origin.y;
            chain.origin = this.origin;
            this.spine = chain;
            return this;
        }

        /**
         * 添加肢体链，挂在脊柱的某关节点上
         * @param {string} id 如 'leftArm' / 'rightLeg'
         * @param {KinematicChain} chain 该肢体的链
         * @param {number} pointIndex 脊柱 points 的索引（0=根，越大越靠上）
         * @param {number} offsetX 相对该关节的 x 偏移
         * @param {number} offsetY 相对该关节的 y 偏移
         */
        addLimb(id, chain, pointIndex, offsetX = 0, offsetY = 0) {
            this.limbs[id] = { chain, pointIndex, offsetX, offsetY };
            if (!this.limbOrder.includes(id)) this.limbOrder.push(id);
            return this;
        }

        /** 根据脊柱当前姿态计算肢体 id 的根位置 */
        getLimbRoot(id) {
            const limb = this.limbs[id];
            if (!limb || !this.spine) return null;
            const pts = this.spine.points;
            const i = Math.min(limb.pointIndex, pts.length - 1);
            const p = pts[i];
            return new Vec2(p.x + limb.offsetX, p.y + limb.offsetY);
        }

        /**
         * 先更新脊柱（FK 或脊柱末端 IK），再根据脊柱关节点更新各肢体根，最后对每条肢体做 IK
         * @param {Object} options
         * @param {number} options.spineTargetX 若提供，脊柱末端做 IK 指向该点
         * @param {number} options.spineTargetY
         * @param {Object} options.limbTargets { leftArm: [x,y], rightLeg: [x,y], ... }
         * @param {Object} options.ikOptions 传给 solveIK 的 options
         */
        solve(options = {}) {
            const { spineTargetX, spineTargetY, limbTargets = {}, ikOptions = {} } = options;

            if (this.spine) {
                if (spineTargetX != null && spineTargetY != null) {
                    this.spine.solveIK(spineTargetX, spineTargetY, ikOptions);
                } else {
                    this.spine.updateFK();
                }
            }

            for (const id of this.limbOrder) {
                const limb = this.limbs[id];
                const root = this.getLimbRoot(id);
                if (!root) continue;
                limb.chain.origin.x = root.x;
                limb.chain.origin.y = root.y;
                const t = limbTargets[id];
                if (t != null) {
                    const x = Array.isArray(t) ? t[0] : t.x;
                    const y = Array.isArray(t) ? t[1] : t.y;
                    limb.chain.solveIK(x, y, ikOptions);
                }
            }
            return this;
        }

        /** 返回脊柱 + 所有肢体的关节点（用于绘制） */
        getAllPoints() {
            const out = [];
            if (this.spine) out.push(...this.spine.points);
            for (const id of this.limbOrder) {
                const limb = this.limbs[id];
                if (limb && limb.chain.points.length) out.push(...limb.chain.points);
            }
            return out;
        }
    }

    // ---------- 树状分叉链（多末端 FABRIK） ----------
    /**
     * TreeChain：树状结构，一个节点可有多个子节点，多个末端
     * 节点：{ id, parent, children: [], length, constraint, pos: Vec2 }
     */
    class TreeChain {
        constructor(originX = 0, originY = 0) {
            this.origin = new Vec2(originX, originY);
            this.root = {
                id: 'root',
                parent: null,
                children: [],
                length: 0,
                constraint: null,
                pos: new Vec2(originX, originY)
            };
            this._nodesById = { root: this.root };
            this._leaves = [this.root]; // 无子节点则为叶，初始只有 root
        }

        /**
         * 在父节点下添加子节点（或挂一条“链”）
         * @param {string} parentId 父节点 id
         * @param {number} length 到父节点的段长
         * @param {Object} constraint 可选 { min, max } 弧度
         * @returns {string} 新节点 id
         */
        addNode(parentId, length, constraint = null) {
            const parent = this._nodesById[parentId];
            if (!parent) return null;
            const id = 'n' + (Object.keys(this._nodesById).length);
            const pos = new Vec2(parent.pos.x + length, parent.pos.y);
            const node = {
                id,
                parent,
                children: [],
                length: Math.max(0, length),
                constraint,
                pos
            };
            parent.children.push(node);
            this._nodesById[id] = node;
            this._leaves = null; // 缓存失效
            return id;
        }

        /**
         * 从父节点一次性挂一条链（多段），返回末端节点 id
         */
        addBranch(parentId, segmentLengths, constraints = []) {
            let currentId = parentId;
            for (let i = 0; i < segmentLengths.length; i++) {
                currentId = this.addNode(currentId, segmentLengths[i], constraints[i] || null);
                if (currentId == null) return null;
            }
            return currentId;
        }

        _getLeaves() {
            if (this._leaves && this._leaves.length) return this._leaves;
            const leaves = [];
            function collect(n) {
                if (n.children.length === 0) leaves.push(n);
                else n.children.forEach(collect);
            }
            collect(this.root);
            this._leaves = leaves;
            return leaves;
        }

        /**
         * 多末端 FABRIK。targets 与 getLeaves() 顺序一致，每项 [x,y] 或 {x,y}
         */
        solveIK(targets, options = {}) {
            const maxIter = options.iterations ?? 12;
            const tolSq = (options.tolerance ?? 1e-4) ** 2;
            const leaves = this._getLeaves();
            if (leaves.length === 0) return;
            const nTargets = Math.min(leaves.length, targets.length);

            const ox = this.origin.x, oy = this.origin.y;

            for (let iter = 0; iter < maxIter; iter++) {
                // Backward: 每个叶设为目标，向根推
                for (let i = 0; i < nTargets; i++) {
                    const t = targets[i];
                    const tx = Array.isArray(t) ? t[0] : t.x;
                    const ty = Array.isArray(t) ? t[1] : t.y;
                    leaves[i].pos.x = tx;
                    leaves[i].pos.y = ty;
                }

                const updated = new Set(leaves);
                let changed = true;
                while (changed) {
                    changed = false;
                    for (const node of Object.values(this._nodesById)) {
                        if (node === this.root || updated.has(node)) continue;
                        const children = node.children.filter(c => updated.has(c));
                        if (children.length === 0) continue;
                        // 所有子都已更新：根据子反推本节点
                        let sumX = 0, sumY = 0;
                        for (const ch of children) {
                            Vec2.sub(node.pos, ch.pos, _dir).normalizeSelf();
                            const len = ch.length;
                            sumX += ch.pos.x + _dir.x * len;
                            sumY += ch.pos.y + _dir.y * len;
                        }
                        node.pos.x = sumX / children.length;
                        node.pos.y = sumY / children.length;
                        updated.add(node);
                        changed = true;
                    }
                }

                // Forward: 根固定，向叶推
                this.root.pos.x = ox;
                this.root.pos.y = oy;
                const queue = [this.root];
                while (queue.length) {
                    const node = queue.shift();
                    for (const ch of node.children) {
                        Vec2.sub(ch.pos, node.pos, _dir).normalizeSelf();
                        let len = ch.length;
                        const con = ch.constraint;
                        if (con && (con.min != null || con.max != null)) {
                            const curAngle = Math.atan2(_dir.y, _dir.x);
                            const prevAngle = node.parent
                                ? Math.atan2(node.pos.y - node.parent.pos.y, node.pos.x - node.parent.pos.x)
                                : 0;
                            const relMin = con.min != null ? con.min : -Math.PI;
                            const relMax = con.max != null ? con.max : Math.PI;
                            const want = clampAngle(curAngle, prevAngle + relMin, prevAngle + relMax);
                            _dir.x = Math.cos(want);
                            _dir.y = Math.sin(want);
                        }
                        ch.pos.x = node.pos.x + _dir.x * len;
                        ch.pos.y = node.pos.y + _dir.y * len;
                        queue.push(ch);
                    }
                }
            }
        }

        /** 按 getLeaves() 顺序返回末端位置 */
        getEndpoints() {
            return this._getLeaves().map(n => n.pos);
        }

        /** 设置根位置 */
        setOrigin(x, y) {
            this.origin.x = x;
            this.origin.y = y;
            return this;
        }
    }

    return {
        Vec2,
        KinematicChain,
        MultiChain,
        KinematicSkeleton,
        TreeChain
    };
})();

if (typeof window !== 'undefined') window.KineticsCore = KineticsCore;
