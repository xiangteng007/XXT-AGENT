/**
 * lego-minifig.ts — Three.js LEGO 樂高人物 3D 幾何體 + 動畫
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export type Status = 'idle' | 'working' | 'thinking' | 'talking' | 'offline';

export interface HeroConfig {
  id: string; heroName: string; role: string; lore: string; model: string;
  bodyColor: number; headColor: number; legsColor: number; accentColor: number;
  hasCape?: boolean; hasMask?: boolean; hasShield?: boolean; hasHelmet?: boolean;
  position: [number, number, number];
  capabilities: string[]; superPowers: string[];
}

function mat(color: number, emissive = 0, shine = 90): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color, shininess: shine,
    specular: new THREE.Color(0.3, 0.3, 0.3),
    emissive: new THREE.Color(emissive ? emissive : 0),
  });
}

export class LegoMinifig {
  readonly group   = new THREE.Group();
  readonly hitbox!: THREE.Mesh;
  readonly config:  HeroConfig;
  readonly label!:  CSS2DObject;

  private headGrp  = new THREE.Group();
  private bodyGrp  = new THREE.Group();
  private armLGrp  = new THREE.Group();
  private armRGrp  = new THREE.Group();
  private legLGrp  = new THREE.Group();
  private legRGrp  = new THREE.Group();

  private status: Status = 'idle';
  private t0 = 0;
  private highlighted = false;

  constructor(cfg: HeroConfig) {
    this.config = cfg;
    this.build();
    this.group.position.set(...cfg.position);
    // @ts-ignore
    this.hitbox = this.buildHitbox();
    // @ts-ignore
    this.label  = this.buildLabel();
  }

  private build(): void {
    const c = this.config;
    const { bodyColor, headColor, legsColor, accentColor } = c;

    /* HEAD */
    this.headGrp.position.y = 5.2;
    this.group.add(this.headGrp);

    const headBox = new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,1.4), mat(headColor));
    headBox.castShadow = true;
    this.headGrp.add(headBox);

    // Stud
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.28,16), mat(headColor));
    stud.position.y = .84;
    this.headGrp.add(stud);

    // Eyes
    const eMat = new THREE.MeshBasicMaterial({ color: c.hasMask || c.hasHelmet ? accentColor : 0x222222 });
    const eyeGeo = new THREE.BoxGeometry(.28,.19,.05);
    for (const xo of [-.25,.25]) {
      const eye = new THREE.Mesh(eyeGeo, eMat);
      eye.position.set(xo - (c.hasMask ? .02 : 0), .08, .71);
      this.headGrp.add(eye);
    }
    if (!c.hasMask && !c.hasHelmet) {
      const smile = new THREE.Mesh(new THREE.BoxGeometry(.55,.1,.05), eMat);
      smile.position.set(0,-.22,.71);
      this.headGrp.add(smile);
    }

    /* COLLAR */
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.28,16), mat(0x111111));
    collar.position.y = 4.24;
    this.group.add(collar);

    /* BODY */
    this.bodyGrp.position.y = 3.1;
    this.group.add(this.bodyGrp);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.1,2.0,1.45), mat(bodyColor));
    torso.castShadow = true;
    this.bodyGrp.add(torso);

    // Chest emblem (glowing accent)
    const emblem = new THREE.Mesh(
      new THREE.BoxGeometry(.75,.75,.07),
      new THREE.MeshPhongMaterial({ color: accentColor, emissive: new THREE.Color(accentColor).multiplyScalar(.4), shininess: 120 })
    );
    emblem.position.set(0,.1,.74);
    this.bodyGrp.add(emblem);

    // Cape (Doctor Strange)
    if (c.hasCape) {
      const cTop = new THREE.Mesh(new THREE.BoxGeometry(2.3,.28,.1), mat(0xCC3300));
      cTop.position.set(0,1.0,-.73);
      this.bodyGrp.add(cTop);
      const cBody = new THREE.Mesh(
        new THREE.PlaneGeometry(2.1,2.8),
        new THREE.MeshPhongMaterial({ color: 0xAA2200, side: THREE.DoubleSide, shininess: 50 })
      );
      cBody.position.set(0,-.7,-.74);
      cBody.rotation.x = .08*Math.PI;
      this.bodyGrp.add(cBody);
    }

    // Hip
    const hip = new THREE.Mesh(new THREE.BoxGeometry(2.1,.5,1.45), mat(bodyColor));
    hip.position.y = -1.25;
    this.bodyGrp.add(hip);

    /* ARMS */
    const armGeo = new THREE.CylinderGeometry(.32,.28,1.65,12);
    const handGeo = new THREE.CylinderGeometry(.31,.31,.42,12);
    const handCol = c.hasMask || c.hasHelmet ? bodyColor : 0xFFCC00;

    this.armLGrp.position.set(-1.2,3.0,0);
    this.group.add(this.armLGrp);
    const armL = new THREE.Mesh(armGeo, mat(bodyColor));
    armL.position.y = -.82; armL.castShadow = true;
    this.armLGrp.add(armL);
    const handL = new THREE.Mesh(handGeo, mat(handCol));
    handL.position.y = -1.72;
    this.armLGrp.add(handL);

    this.armRGrp.position.set(1.2,3.0,0);
    this.group.add(this.armRGrp);
    const armR = new THREE.Mesh(armGeo, mat(bodyColor));
    armR.position.y = -.82; armR.castShadow = true;
    this.armRGrp.add(armR);
    const handR = new THREE.Mesh(handGeo, mat(handCol));
    handR.position.y = -1.72;
    this.armRGrp.add(handR);

    // Shield (Captain America) on left arm
    if (c.hasShield) {
      const sg = new THREE.Group();
      sg.position.set(-.65,-.9,.5);
      const shColors = [0x1565C0, 0xCC2200, 0xEEEEEE, 0xCC2200];
      const shRadii  = [.72, .57, .40, .24];
      for (let i = 0; i < 4; i++) {
        const sRing = new THREE.Mesh(
          new THREE.CylinderGeometry(shRadii[i]!,shRadii[i]!,.07-i*.01,32),
          mat(shColors[i]!)
        );
        sRing.rotation.x = Math.PI/2;
        sRing.position.z = i*.02;
        sg.add(sRing);
      }
      this.armLGrp.add(sg);
    }

    /* LEGS */
    const legGeo  = new THREE.BoxGeometry(.9,1.8,1.2);
    const bootGeo = new THREE.BoxGeometry(.94,.44,1.4);
    const bootMat = mat(0x111111);

    this.legLGrp.position.set(-.54,1.68,0);
    this.group.add(this.legLGrp);
    const legL = new THREE.Mesh(legGeo, mat(legsColor));
    legL.position.y = -.9; legL.castShadow = true;
    this.legLGrp.add(legL);
    const bootL = new THREE.Mesh(bootGeo, bootMat);
    bootL.position.set(0,-1.82,.01);
    this.legLGrp.add(bootL);

    this.legRGrp.position.set(.54,1.68,0);
    this.group.add(this.legRGrp);
    const legR = new THREE.Mesh(legGeo, mat(legsColor));
    legR.position.y = -.9; legR.castShadow = true;
    this.legRGrp.add(legR);
    const bootR = new THREE.Mesh(bootGeo, bootMat);
    bootR.position.set(0,-1.82,.01);
    this.legRGrp.add(bootR);

    // Ground shadow disk
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(.9,32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3 })
    );
    disk.rotation.x = -Math.PI/2;
    disk.position.y = -1.62;
    this.group.add(disk);
  }

  private buildHitbox(): THREE.Mesh {
    const hb = new THREE.Mesh(
      new THREE.BoxGeometry(2.8,7.5,2.8),
      new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
    );
    hb.position.y = 3.2;
    hb.userData['heroId'] = this.config.id;
    this.group.add(hb);
    return hb;
  }

  private buildLabel(): CSS2DObject {
    const div = document.createElement('div');
    div.className = 'hero-label';
    div.innerHTML = `
      <div class="hl-name">${this.config.heroName}</div>
      <div class="hl-role">${this.config.role}</div>
      <div class="hl-bubble" id="bub-${this.config.id}"></div>
    `;
    div.addEventListener('click', () => {
      // dispatch custom event
      window.dispatchEvent(new CustomEvent('hero-click', { detail: this.config.id }));
    });
    const obj = new CSS2DObject(div);
    obj.position.set(0, 7.4, 0);
    this.group.add(obj);
    return obj;
  }

  setStatus(s: Status, bubble?: string): void {
    this.status = s;
    if (bubble) this.showBubble(bubble);
  }

  showBubble(text: string, ms = 4500): void {
    const b = document.getElementById(`bub-${this.config.id}`);
    if (!b) return;
    b.textContent = text;
    b.classList.add('vis');
    setTimeout(() => b.classList.remove('vis'), ms);
  }

  setHighlight(on: boolean): void {
    if (this.highlighted === on) return;
    this.highlighted = on;
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshPhongMaterial) {
        if (on) {
          obj.material.emissive.setHex(this.config.accentColor);
          obj.material.emissiveIntensity = .25;
        } else {
          obj.material.emissive.setHex(0);
          obj.material.emissiveIntensity = 0;
        }
        obj.material.needsUpdate = true;
      }
    });
  }

  update(t: number): void {
    const ph = t - this.t0;
    let by = 0, ht = 0, alx = 0, arx = 0, alz = 0, arz = 0, llx = 0, lrx = 0;

    switch (this.status) {
      case 'idle':
        by  = Math.sin(t*1.1)*.06;
        ht  = Math.sin(t*.7)*.06;
        break;
      case 'working':
        by  = Math.sin(t*1.5)*.04 - .08;
        ht  = -.15;                          // look down
        alx = Math.sin(t*6.0)*.3 - .45;     // typing L
        arx = Math.sin(t*6.0+Math.PI)*.3-.45; // typing R
        break;
      case 'thinking':
        by  = Math.sin(t*.6)*.04;
        ht  = Math.sin(t*.5)*.12+.1;
        arx = -1.2 + Math.sin(t*.6)*.08;    // arm to chin
        alx = -.15;
        break;
      case 'talking':
        by  = Math.abs(Math.sin(t*4.5))*.14;
        ht  = Math.sin(t*3.0)*.2;
        alx = Math.sin(t*3.5)*.7 - .3;      // wave L
        arx = Math.cos(t*3.5)*.55 - .3;     // wave R
        break;
      case 'offline':
        by  = -.3;
        ht  = .45;
        alz = -.5;  arx = .5;
        break;
    }

    this.bodyGrp.position.y = 3.1 + by;
    this.headGrp.rotation.z = ht;
    this.armLGrp.rotation.x = alx;
    this.armRGrp.rotation.x = arx;
    this.armLGrp.rotation.z = alz;
    this.armRGrp.rotation.z = arz;
    this.legLGrp.rotation.x = llx;
    this.legRGrp.rotation.x = lrx;
  }
}
