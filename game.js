const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  playerHealth: document.getElementById("playerHealth"),
  zombieCount: document.getElementById("zombieCount"),
  weaponName: document.getElementById("weaponName"),
  kills: document.getElementById("kills"),
  buttons: [...document.querySelectorAll(".weapon")],
};

const world = {
  width: 3600,
  height: 2200,
};

const camera = {
  x: 0,
  y: 0,
};

const mouse = {
  screenX: canvas.width / 2,
  screenY: canvas.height / 2,
  x: world.width / 2,
  y: world.height / 2,
  down: false,
};
const keys = new Set();
const PLAYER_HEALTH = 200_000;
const ZOMBIE_HEALTH = 1_000;
const PLAYER_REGEN_PER_SECOND = 20_000;
const ALLY_HEALTH = 1_000;
const ALLY_ARMOR = 1_000;

const player = {
  x: world.width / 2,
  y: world.height / 2,
  radius: 18,
  speed: 300,
  angle: 0,
  hp: PLAYER_HEALTH,
  weapon: "minigun",
};

const weapons = {
  minigun: { label: "MINIGUN", damage: 24, speed: 920, color: "#ffd166" },
  laser: { label: "LASER", damage: 72, speed: 1500, color: "#6ef2ff" },
  grenade: { label: "LỰU ĐẠN", damage: 130, speed: 420, color: "#ff9f43", splash: 120 },
  tomahawk: { label: "TÊN LỬA TOMAHAWK", damage: 240, speed: 840, color: "#d7e2ea", splash: 170 },
};

const bullets = [];
const enemyBullets = [];
const allyBullets = [];
const allies = [];
const zombies = [];
const particles = [];
const flashes = [];
let spawnTimer = 2;
let allySpawnTimer = 10;
let kills = 0;
let lastTime = performance.now();

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function setWeapon(nextWeapon) {
  if (!weapons[nextWeapon]) return;
  player.weapon = nextWeapon;
  ui.weaponName.textContent = weapons[nextWeapon].label;
  ui.buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.weapon === nextWeapon);
  });
}

function spawnZombie(type) {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const archetype =
    type === "gunner"
      ? {
          type: "gunner",
          weapon: "SÚNG",
          color: "#6f8e78",
          speed: rand(38, 62),
          attackRange: rand(360, 520),
          contactDamage: 3,
          fireRate: rand(0.85, 1.25),
          bulletSpeed: rand(360, 460),
          bulletDamage: rand(14, 20),
          radius: rand(18, 23),
        }
      : {
          type: "sword",
          weapon: "KIẾM",
          color: "#7c6f8f",
          speed: rand(68, 102),
          attackRange: 58,
          contactDamage: 62,
          fireRate: 0,
          bulletSpeed: 0,
          bulletDamage: 0,
          radius: rand(20, 26),
        };

  if (edge === 0) {
    x = rand(0, world.width);
    y = -40;
  } else if (edge === 1) {
    x = world.width + 40;
    y = rand(0, world.height);
  } else if (edge === 2) {
    x = rand(0, world.width);
    y = world.height + 40;
  } else {
    x = -40;
    y = rand(0, world.height);
  }

  zombies.push({
    x,
    y,
    radius: archetype.radius,
    hp: ZOMBIE_HEALTH,
    maxHp: ZOMBIE_HEALTH,
    speed: archetype.speed,
    hitFlash: 0,
    type: archetype.type,
    weapon: archetype.weapon,
    color: archetype.color,
    attackRange: archetype.attackRange,
    contactDamage: archetype.contactDamage,
    fireRate: archetype.fireRate,
    bulletSpeed: archetype.bulletSpeed,
    bulletDamage: archetype.bulletDamage,
    attackCooldown: rand(0.15, 1.2),
  });
}

function spawnAlly() {
  const angle = rand(0, Math.PI * 2);
  const radius = rand(60, 240);
  const x = clamp(player.x + Math.cos(angle) * radius, 40, world.width - 40);
  const y = clamp(player.y + Math.sin(angle) * radius, 40, world.height - 40);
  const loadoutKeys = Object.keys(weapons);
  const weaponKey = loadoutKeys[Math.floor(Math.random() * loadoutKeys.length)];
  const loadout = weapons[weaponKey];

  allies.push({
    x,
    y,
    radius: 15,
    hp: ALLY_HEALTH,
    maxHp: ALLY_HEALTH,
    speed: rand(150, 200),
    color: "#5f8ef5",
    armor: ALLY_ARMOR,
    maxArmor: ALLY_ARMOR,
    cooldown: rand(0.05, 0.6),
    weaponKey,
    weaponLabel: loadout.label,
    fireRate:
      weaponKey === "minigun" ? rand(0.05, 0.08) :
      weaponKey === "laser" ? rand(0.14, 0.2) :
      weaponKey === "grenade" ? rand(0.55, 0.75) :
      rand(0.45, 0.65),
    damage: loadout.damage * rand(0.9, 1.2),
    bulletSpeed: loadout.speed * rand(0.9, 1.05),
    splash: loadout.splash ?? 0,
    angle: 0,
    hitFlash: 0,
  });
}

function emitParticles(x, y, color, count, speed = 140) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const velocity = rand(speed * 0.35, speed);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: rand(0.25, 0.7),
      maxLife: rand(0.25, 0.7),
      size: rand(2, 5),
      color,
    });
  }
}

function createFlash(x, y, color, radius) {
  flashes.push({ x, y, color, radius, life: 0.12, maxLife: 0.12 });
}

function updateCamera() {
  camera.x = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);
  mouse.x = mouse.screenX + camera.x;
  mouse.y = mouse.screenY + camera.y;
}

function fireWeapon() {
  const weapon = weapons[player.weapon];
  const angle = player.angle;
  const muzzleX = player.x + Math.cos(angle) * 26;
  const muzzleY = player.y + Math.sin(angle) * 26;

  createFlash(muzzleX, muzzleY, weapon.color, player.weapon === "laser" ? 28 : 18);

  if (player.weapon === "minigun") {
    const spread = rand(-0.08, 0.08);
    bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(angle + spread) * weapon.speed,
      vy: Math.sin(angle + spread) * weapon.speed,
      damage: weapon.damage,
      radius: 4,
      life: 0.9,
      color: weapon.color,
      type: "bullet",
    });
  } else if (player.weapon === "laser") {
    bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      damage: weapon.damage,
      radius: 5,
      life: 0.24,
      color: weapon.color,
      type: "laser",
    });
  } else if (player.weapon === "grenade") {
    bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      damage: weapon.damage,
      radius: 8,
      life: 1.35,
      color: weapon.color,
      type: "grenade",
      splash: weapon.splash,
    });
  } else if (player.weapon === "tomahawk") {
    bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      damage: weapon.damage,
      radius: 16,
      life: 1.5,
      color: weapon.color,
      type: "tomahawk",
      splash: weapon.splash,
      exhaustTimer: 0,
    });
  }
}

function damageZombie(zombie, amount, hitX, hitY) {
  zombie.hp -= amount;
  zombie.hitFlash = 0.12;
  emitParticles(hitX, hitY, "#b31217", 9, 180);

  if (zombie.hp <= 0) {
    kills += 1;
    emitParticles(zombie.x, zombie.y, "#460609", 28, 240);
    return true;
  }

  return false;
}

function explodeGrenade(grenade) {
  createFlash(grenade.x, grenade.y, "rgba(255,150,50,0.95)", grenade.splash);
  emitParticles(grenade.x, grenade.y, "#ff9f43", 34, 260);

  for (const zombie of zombies) {
    const dist = distance(grenade.x, grenade.y, zombie.x, zombie.y);
    if (dist <= grenade.splash + zombie.radius) {
      const falloff = 1 - clamp(dist / grenade.splash, 0, 1);
      damageZombie(zombie, grenade.damage * (0.4 + falloff * 0.6), grenade.x, grenade.y);
    }
  }
}

function explodeMissile(missile) {
  createFlash(missile.x, missile.y, "rgba(255,235,190,0.95)", missile.splash);
  emitParticles(missile.x, missile.y, "#f06d2f", 50, 320);
  emitParticles(missile.x, missile.y, "#2f2f2f", 28, 160);

  for (let i = zombies.length - 1; i >= 0; i -= 1) {
    const zombie = zombies[i];
    const dist = distance(missile.x, missile.y, zombie.x, zombie.y);
    if (dist <= missile.splash + zombie.radius) {
      const falloff = 1 - clamp(dist / missile.splash, 0, 1);
      const dead = damageZombie(
        zombie,
        missile.damage * (0.5 + falloff * 0.8),
        missile.x,
        missile.y
      );
      if (dead) zombies.splice(i, 1);
    }
  }
}

function findNearestZombie(x, y) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const zombie of zombies) {
    const dist = distance(x, y, zombie.x, zombie.y);
    if (dist < nearestDist) {
      nearest = zombie;
      nearestDist = dist;
    }
  }

  return { nearest, nearestDist };
}

function updatePlayer(dt) {
  let moveX = 0;
  let moveY = 0;

  if (keys.has("w")) moveY -= 1;
  if (keys.has("s")) moveY += 1;
  if (keys.has("a")) moveX -= 1;
  if (keys.has("d")) moveX += 1;

  const length = Math.hypot(moveX, moveY) || 1;
  player.x += (moveX / length) * player.speed * dt;
  player.y += (moveY / length) * player.speed * dt;
  player.x = clamp(player.x, 28, world.width - 28);
  player.y = clamp(player.y, 28, world.height - 28);

  player.hp = clamp(player.hp + PLAYER_REGEN_PER_SECOND * dt, 0, PLAYER_HEALTH);
  updateCamera();
  player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

  if (mouse.down) fireWeapon();
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.type === "tomahawk") {
      bullet.exhaustTimer -= dt;
      if (bullet.exhaustTimer <= 0) {
        emitParticles(bullet.x - bullet.vx * 0.01, bullet.y - bullet.vy * 0.01, "#9c9c9c", 3, 60);
        bullet.exhaustTimer = 0.03;
      }
    }

    let removed = false;

    for (let z = zombies.length - 1; z >= 0; z -= 1) {
      const zombie = zombies[z];
      if (distance(bullet.x, bullet.y, zombie.x, zombie.y) <= bullet.radius + zombie.radius) {
        if (bullet.type === "grenade") {
          explodeGrenade(bullet);
        } else if (bullet.type === "tomahawk") {
          explodeMissile(bullet);
        } else {
          const dead = damageZombie(zombie, bullet.damage, bullet.x, bullet.y);
          if (dead) zombies.splice(z, 1);

          if (bullet.type === "laser") {
            createFlash(bullet.x, bullet.y, "rgba(110,242,255,0.9)", 22);
          }
        }

        bullets.splice(i, 1);
        removed = true;
        break;
      }
    }

    if (removed) continue;

    if (bullet.type === "grenade" && bullet.life <= 0) {
      explodeGrenade(bullet);
      bullets.splice(i, 1);
      continue;
    }

    if (bullet.type === "tomahawk" && bullet.life <= 0) {
      explodeMissile(bullet);
      bullets.splice(i, 1);
      continue;
    }

    if (
      bullet.life <= 0 ||
      bullet.x < -80 ||
      bullet.y < -80 ||
      bullet.x > world.width + 80 ||
      bullet.y > world.height + 80
    ) {
      bullets.splice(i, 1);
    }
  }
}

function updateEnemyBullets(dt) {
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.targetType === "player" &&
      distance(bullet.x, bullet.y, player.x, player.y) <= bullet.radius + player.radius
    ) {
      player.hp = Math.max(0, player.hp - bullet.damage);
      createFlash(bullet.x, bullet.y, "rgba(255,100,77,0.85)", 16);
      enemyBullets.splice(i, 1);
      continue;
    }

    if (bullet.targetType === "ally") {
      let hitAlly = false;
      for (const ally of allies) {
        if (distance(bullet.x, bullet.y, ally.x, ally.y) <= bullet.radius + ally.radius) {
          ally.hp = Math.max(0, ally.hp - bullet.damage);
          ally.hitFlash = 0.12;
          createFlash(bullet.x, bullet.y, "rgba(255,100,77,0.85)", 16);
          enemyBullets.splice(i, 1);
          hitAlly = true;
          break;
        }
      }
      if (hitAlly) continue;
    }

    if (
      bullet.life <= 0 ||
      bullet.x < -80 ||
      bullet.y < -80 ||
      bullet.x > world.width + 80 ||
      bullet.y > world.height + 80
    ) {
      enemyBullets.splice(i, 1);
    }
  }
}

function updateAllyBullets(dt) {
  for (let i = allyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = allyBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    let removed = false;
    for (let z = zombies.length - 1; z >= 0; z -= 1) {
      const zombie = zombies[z];
      if (distance(bullet.x, bullet.y, zombie.x, zombie.y) <= bullet.radius + zombie.radius) {
        if (bullet.type === "grenade" || bullet.type === "tomahawk") {
          const splash = bullet.splash || 0;
          for (let j = zombies.length - 1; j >= 0; j -= 1) {
            const splashZombie = zombies[j];
            const dist = distance(bullet.x, bullet.y, splashZombie.x, splashZombie.y);
            if (dist <= splash + splashZombie.radius) {
              const falloff = 1 - clamp(dist / splash, 0, 1);
              const dead = damageZombie(
                splashZombie,
                bullet.damage * (0.45 + falloff * 0.75),
                bullet.x,
                bullet.y
              );
              if (dead) zombies.splice(j, 1);
            }
          }
          createFlash(bullet.x, bullet.y, "rgba(141,184,255,0.9)", splash || 20);
          emitParticles(bullet.x, bullet.y, "#8db8ff", 20, 180);
        } else {
          const dead = damageZombie(zombie, bullet.damage, bullet.x, bullet.y);
          if (dead) zombies.splice(z, 1);
        }
        allyBullets.splice(i, 1);
        removed = true;
        break;
      }
    }

    if (removed) continue;

    if (
      bullet.life <= 0 ||
      bullet.x < -80 ||
      bullet.y < -80 ||
      bullet.x > world.width + 80 ||
      bullet.y > world.height + 80
    ) {
      allyBullets.splice(i, 1);
    }
  }
}

function updateAllies(dt) {
  for (let i = allies.length - 1; i >= 0; i -= 1) {
    const ally = allies[i];
    ally.cooldown = Math.max(0, ally.cooldown - dt);
    ally.hitFlash = Math.max(0, ally.hitFlash - dt);

    const { nearest, nearestDist } = findNearestZombie(ally.x, ally.y);
    if (nearest) {
      ally.angle = Math.atan2(nearest.y - ally.y, nearest.x - ally.x);

      if (nearestDist > 260) {
        ally.x += Math.cos(ally.angle) * ally.speed * dt;
        ally.y += Math.sin(ally.angle) * ally.speed * dt;
      } else if (nearestDist < 120) {
        ally.x -= Math.cos(ally.angle) * ally.speed * 0.65 * dt;
        ally.y -= Math.sin(ally.angle) * ally.speed * 0.65 * dt;
      }

      if (ally.cooldown <= 0 && nearestDist <= 480) {
        const spread = rand(-0.05, 0.05);
        const shotAngle = ally.angle + spread;
        const muzzleX = ally.x + Math.cos(shotAngle) * 20;
        const muzzleY = ally.y + Math.sin(shotAngle) * 20;
        allyBullets.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(shotAngle) * ally.bulletSpeed,
          vy: Math.sin(shotAngle) * ally.bulletSpeed,
          damage: ally.damage,
          radius: ally.weaponKey === "tomahawk" ? 12 : ally.weaponKey === "grenade" ? 7 : 4,
          life: ally.weaponKey === "tomahawk" ? 1.3 : ally.weaponKey === "grenade" ? 1.1 : 1.1,
          color:
            ally.weaponKey === "minigun" ? "#8db8ff" :
            ally.weaponKey === "laser" ? "#6ef2ff" :
            ally.weaponKey === "grenade" ? "#ffb36b" :
            "#d7e2ea",
          type: ally.weaponKey,
          splash: ally.splash,
        });
        createFlash(muzzleX, muzzleY, "rgba(141,184,255,0.9)", 11);
        ally.cooldown = ally.fireRate;
      }
    } else {
      ally.angle = Math.atan2(player.y - ally.y, player.x - ally.x);
      if (distance(ally.x, ally.y, player.x, player.y) > 120) {
        ally.x += Math.cos(ally.angle) * ally.speed * 0.55 * dt;
        ally.y += Math.sin(ally.angle) * ally.speed * 0.55 * dt;
      }
    }

    ally.x = clamp(ally.x, 30, world.width - 30);
    ally.y = clamp(ally.y, 30, world.height - 30);

    for (const zombie of zombies) {
      if (distance(ally.x, ally.y, zombie.x, zombie.y) <= ally.radius + zombie.radius + 2) {
        const incoming = zombie.contactDamage * dt * 0.8;
        const armorAbsorb = Math.min(ally.armor, incoming * 0.8);
        ally.armor -= armorAbsorb;
        ally.hp = Math.max(0, ally.hp - (incoming - armorAbsorb));
        ally.hitFlash = 0.1;
      }
    }

    if (ally.hp <= 0) {
      emitParticles(ally.x, ally.y, "#3c6df0", 16, 180);
      allies.splice(i, 1);
    }
  }
}

function updateZombies(dt) {
  for (let i = zombies.length - 1; i >= 0; i -= 1) {
    const zombie = zombies[i];
    const targetPool = allies.length > 0 && Math.random() < 0.6 ? allies : [player];
    let target = targetPool[Math.floor(Math.random() * targetPool.length)];
    let bestDist = distance(zombie.x, zombie.y, target.x, target.y);

    if (targetPool === allies) {
      for (const ally of allies) {
        const dist = distance(zombie.x, zombie.y, ally.x, ally.y);
        if (dist < bestDist) {
          target = ally;
          bestDist = dist;
        }
      }
      const playerDist = distance(zombie.x, zombie.y, player.x, player.y);
      if (playerDist < bestDist * 0.85) {
        target = player;
        bestDist = playerDist;
      }
    }

    const angle = Math.atan2(target.y - zombie.y, target.x - zombie.x);
    const distToTarget = bestDist;
    zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);
    zombie.hitFlash = Math.max(0, zombie.hitFlash - dt);

    if (zombie.type === "gunner") {
      if (distToTarget > zombie.attackRange * 0.9) {
        zombie.x += Math.cos(angle) * zombie.speed * dt;
        zombie.y += Math.sin(angle) * zombie.speed * dt;
      } else if (distToTarget < zombie.attackRange * 0.55) {
        zombie.x -= Math.cos(angle) * zombie.speed * 0.7 * dt;
        zombie.y -= Math.sin(angle) * zombie.speed * 0.7 * dt;
      }

      if (zombie.attackCooldown <= 0 && distToTarget <= zombie.attackRange) {
        const spread = rand(-0.09, 0.09);
        const bulletAngle = angle + spread;
        const muzzleX = zombie.x + Math.cos(bulletAngle) * (zombie.radius + 8);
        const muzzleY = zombie.y + Math.sin(bulletAngle) * (zombie.radius + 8);
        enemyBullets.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(bulletAngle) * zombie.bulletSpeed,
          vy: Math.sin(bulletAngle) * zombie.bulletSpeed,
          damage: zombie.bulletDamage,
          radius: 4,
          life: 2.3,
          color: "#ff7f50",
          targetType: target === player ? "player" : "ally",
        });
        createFlash(muzzleX, muzzleY, "rgba(255,174,66,0.9)", 14);
        zombie.attackCooldown = zombie.fireRate;
      }
    } else {
      zombie.x += Math.cos(angle) * zombie.speed * dt;
      zombie.y += Math.sin(angle) * zombie.speed * dt;
    }

    const targetRadius = target.radius ?? 18;
    if (distToTarget <= zombie.radius + targetRadius + zombie.attackRange * 0.08 + 4) {
      if (target === player) {
        player.hp = Math.max(0, player.hp - zombie.contactDamage * dt);
      } else {
        target.hp = Math.max(0, target.hp - zombie.contactDamage * dt);
        target.hitFlash = 0.12;
      }
      const push = 36 * dt;
      zombie.x -= Math.cos(angle) * push;
      zombie.y -= Math.sin(angle) * push;
    }

    if (zombie.hp <= 0) {
      zombies.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.97;
    particle.vy *= 0.97;
    particle.life -= dt;

    if (particle.life <= 0) particles.splice(i, 1);
  }

  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    flashes[i].life -= dt;
    if (flashes[i].life <= 0) flashes.splice(i, 1);
  }
}

function updateSpawning(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    for (let i = 0; i < 17; i += 1) spawnZombie("gunner");
    for (let i = 0; i < 33; i += 1) spawnZombie("sword");
    spawnTimer = 2;
  }

  allySpawnTimer -= dt;
  if (allySpawnTimer <= 0) {
    for (let i = 0; i < 40; i += 1) spawnAlly();
    allySpawnTimer = 4;
  }
}

function drawGround() {
  const gradient = ctx.createLinearGradient(0, 0, 0, world.height);
  gradient.addColorStop(0, "#202521");
  gradient.addColorStop(1, "#101412");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 0; y <= world.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }
  ctx.restore();

  for (let x = 180; x < world.width; x += 520) {
    ctx.fillStyle = "rgba(48, 51, 50, 0.8)";
    ctx.fillRect(x, 120, 170, world.height - 240);
    ctx.fillStyle = "rgba(22, 22, 22, 0.35)";
    ctx.fillRect(x + 18, 140, 134, world.height - 280);
  }

  for (let y = 260; y < world.height; y += 480) {
    ctx.fillStyle = "rgba(96, 93, 82, 0.18)";
    ctx.fillRect(0, y, world.width, 120);
    ctx.fillStyle = "rgba(255, 214, 102, 0.18)";
    for (let x = 0; x < world.width; x += 160) {
      ctx.fillRect(x + 32, y + 56, 72, 8);
    }
  }

  for (let i = 0; i < 26; i += 1) {
    const baseX = 120 + i * 132;
    const baseY = 160 + (i % 5) * 380;
    ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.14)" : "rgba(84, 116, 82, 0.045)";
    ctx.beginPath();
    ctx.arc(baseX % world.width, baseY, 42 + (i % 4) * 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#dad7cd";
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#30363a";
  ctx.fillRect(-2, -7, 30, 14);

  ctx.fillStyle = weapons[player.weapon].color;
  ctx.fillRect(18, -3, 18, 6);

  ctx.fillStyle = "#5f6b73";
  ctx.beginPath();
  ctx.arc(-4, -3, 4, 0, Math.PI * 2);
  ctx.arc(-4, 3, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAlly(ally) {
  ctx.save();
  ctx.translate(ally.x, ally.y);
  ctx.rotate(ally.angle);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ally.hitFlash > 0 ? "#d7e5ff" : ally.color;
  ctx.beginPath();
  ctx.arc(0, 0, ally.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#b8c4d8";
  ctx.beginPath();
  ctx.arc(0, 0, ally.radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(216,228,255,0.75)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#1d2840";
  ctx.fillRect(-2, -5, 24, 10);
  ctx.fillStyle =
    ally.weaponKey === "minigun" ? "#8db8ff" :
    ally.weaponKey === "laser" ? "#6ef2ff" :
    ally.weaponKey === "grenade" ? "#ffb36b" :
    "#d7e2ea";
  ctx.fillRect(16, -2, ally.weaponKey === "tomahawk" ? 18 : 14, 4);

  ctx.fillStyle = "#101010";
  ctx.fillRect(-ally.radius, -ally.radius - 12, ally.radius * 2, 4);
  ctx.fillStyle = "#7bc5ff";
  ctx.fillRect(-ally.radius, -ally.radius - 12, (ally.hp / ally.maxHp) * ally.radius * 2, 4);
  ctx.fillStyle = "#101010";
  ctx.fillRect(-ally.radius, -ally.radius - 18, ally.radius * 2, 4);
  ctx.fillStyle = "#d6e4ff";
  ctx.fillRect(-ally.radius, -ally.radius - 18, (ally.armor / ally.maxArmor) * ally.radius * 2, 4);

  ctx.restore();
}

function drawZombie(zombie) {
  ctx.save();
  ctx.translate(zombie.x, zombie.y);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, zombie.radius + 8, zombie.radius, zombie.radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = zombie.hitFlash > 0 ? "#ffb4a2" : zombie.color;
  ctx.beginPath();
  ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#240b0f";
  ctx.beginPath();
  ctx.arc(-zombie.radius * 0.28, -4, 3.2, 0, Math.PI * 2);
  ctx.arc(zombie.radius * 0.28, -4, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#101010";
  ctx.fillRect(-zombie.radius, -zombie.radius - 14, zombie.radius * 2, 5);
  ctx.fillStyle = "#ff4d4d";
  ctx.fillRect(
    -zombie.radius,
    -zombie.radius - 14,
    (zombie.hp / zombie.maxHp) * zombie.radius * 2,
    5
  );

  ctx.rotate(Math.atan2(player.y - zombie.y, player.x - zombie.x));
  if (zombie.type === "gunner") {
    ctx.fillStyle = "#353c42";
    ctx.fillRect(0, -3, zombie.radius + 12, 6);
  } else if (zombie.type === "knife") {
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(2, -2, zombie.radius + 6, 4);
    ctx.fillStyle = "#5d4632";
    ctx.fillRect(-2, -3, 6, 6);
  } else {
    ctx.fillStyle = "#c6d0d8";
    ctx.fillRect(0, -2, zombie.radius + 16, 4);
    ctx.fillStyle = "#6c7780";
    ctx.fillRect(zombie.radius + 8, -5, 12, 10);
  }

  ctx.restore();
}

function drawBullet(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);

  if (bullet.type === "tomahawk") {
    ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
    ctx.fillStyle = "#262d33";
    ctx.fillRect(-28, -7, 40, 14);
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(2, -10);
    ctx.lineTo(2, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9aa6af";
    ctx.fillRect(-18, -14, 10, 6);
    ctx.fillRect(-18, 8, 10, 6);
    ctx.fillStyle = "#ff8c42";
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(-40, -5);
    ctx.lineTo(-40, 5);
    ctx.closePath();
    ctx.fill();
  } else if (bullet.type === "grenade") {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a2b10";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEffects() {
  for (const flash of flashes) {
    const alpha = flash.life / flash.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = flash.color;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, flash.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const particle of particles) {
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawEnemyBullet(bullet) {
  ctx.fillStyle = bullet.color;
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawAllyBullet(bullet) {
  ctx.fillStyle = bullet.color;
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrosshair() {
  ctx.save();
  ctx.strokeStyle = weapons[player.weapon].color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouse.screenX, mouse.screenY, 14, 0, Math.PI * 2);
  ctx.moveTo(mouse.screenX - 20, mouse.screenY);
  ctx.lineTo(mouse.screenX - 8, mouse.screenY);
  ctx.moveTo(mouse.screenX + 8, mouse.screenY);
  ctx.lineTo(mouse.screenX + 20, mouse.screenY);
  ctx.moveTo(mouse.screenX, mouse.screenY - 20);
  ctx.lineTo(mouse.screenX, mouse.screenY - 8);
  ctx.moveTo(mouse.screenX, mouse.screenY + 8);
  ctx.lineTo(mouse.screenX, mouse.screenY + 20);
  ctx.stroke();
  ctx.restore();
}

function updateUi() {
  ui.playerHealth.textContent = `${Math.round(player.hp).toLocaleString("en-US")} HP`;
  ui.zombieCount.textContent = String(zombies.length);
  ui.kills.textContent = String(kills);
}

function tick(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  updatePlayer(dt);
  updateBullets(dt);
  updateEnemyBullets(dt);
  updateAllyBullets(dt);
  updateAllies(dt);
  updateZombies(dt);
  updateParticles(dt);
  updateSpawning(dt);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGround();
  bullets.forEach(drawBullet);
  enemyBullets.forEach(drawEnemyBullet);
  allyBullets.forEach(drawAllyBullet);
  zombies.forEach(drawZombie);
  allies.forEach(drawAlly);
  drawPlayer();
  drawEffects();
  ctx.restore();
  drawCrosshair();
  updateUi();

  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);

  if (key === "1") setWeapon("minigun");
  if (key === "2") setWeapon("laser");
  if (key === "3") setWeapon("grenade");
  if (key === "4") setWeapon("tomahawk");
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.screenX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.screenY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  mouse.x = mouse.screenX + camera.x;
  mouse.y = mouse.screenY + camera.y;
});

canvas.addEventListener("mousedown", () => {
  mouse.down = true;
});

window.addEventListener("mouseup", () => {
  mouse.down = false;
});

ui.buttons.forEach((button) => {
  button.addEventListener("click", () => setWeapon(button.dataset.weapon));
});

for (let i = 0; i < 17; i += 1) spawnZombie("gunner");
for (let i = 0; i < 33; i += 1) spawnZombie("sword");
setWeapon("minigun");
updateCamera();
updateUi();
requestAnimationFrame(tick);
