import { ayaSeed } from "./aya.js";
import { conanSeed } from "./conan.js";
import { confuciusSeed } from "./confucius.js";
import { doraemonSeed } from "./doraemon.js";
import { hanxinSeed } from "./hanxin.js";
import { huoQubingSeed } from "./huo-qubing.js";
import { laoziSeed } from "./laozi.js";
import { liJingSeed } from "./li-jing.js";
import { lingSeed } from "./ling.js";
import { pikachuSeed } from "./pikachu.js";
import { shenzhouSeed } from "./shenzhou.js";
import { sunwuSeed } from "./sunwu.js";
import { totoroSeed } from "./totoro.js";
import { vangoghSeed } from "./vangogh.js";
import { wangYangmingSeed } from "./wang-yangming.js";
import { xiaomiaoSeed } from "./xiaomiao.js";
import { xiawanSeed } from "./xiawan.js";
import { yuefeiSeed } from "./yuefei.js";
export const allPersonaSeeds = [
    huoQubingSeed,
    hanxinSeed,
    yuefeiSeed,
    liJingSeed,
    sunwuSeed,
    confuciusSeed,
    laoziSeed,
    wangYangmingSeed,
    pikachuSeed,
    doraemonSeed,
    conanSeed,
    totoroSeed,
    xiawanSeed,
    xiaomiaoSeed,
    lingSeed,
    shenzhouSeed,
    vangoghSeed,
    ayaSeed,
];
export { ayaSeed, conanSeed, confuciusSeed, doraemonSeed, hanxinSeed, huoQubingSeed, laoziSeed, liJingSeed, lingSeed, pikachuSeed, shenzhouSeed, sunwuSeed, totoroSeed, vangoghSeed, wangYangmingSeed, xiaomiaoSeed, xiawanSeed, yuefeiSeed, };
export function getPersonaSeedById(id) {
    return allPersonaSeeds.find((seed) => seed.id === id);
}
//# sourceMappingURL=index.js.map