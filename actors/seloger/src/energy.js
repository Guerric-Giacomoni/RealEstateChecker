import { pick, toNumber, asArray } from './utils.js';

/**
 * DPE + GES live in classified.sections.energy.
 *
 * Shape on a real page (Bayeux, 268652599):
 *
 *   energy.features     -> [{type:'state'|'heatingSystem'|'energySource', label, value}]
 *   energy.certificates -> [{
 *       features: [{type:'minMaxEstimation'|'nameOfCertificate'|'estimationDescription', label, value}],
 *       scales: [
 *         { name:'Diagnostic de performance énergétique (DPE)',
 *           efficiencyClass:{ index:3, rating:'D' },
 *           values:[{label:'Consommation (énergie primaire)', value:'228 kWh/m².an'},
 *                   {label:'Émissions', value:'49 kg CO₂/m².an'}],
 *           segments:[{label:'A',value:''}, ...] },
 *         { name:"Indice d'émission de gaz à effet de serre (GES)",
 *           efficiencyClass:{ index:3, rating:'D' },
 *           values:[{label:'Émissions', value:'49 kg CO₂/m².an'}] }
 *       ]
 *   }]
 *
 * Listings exempt from a DPE (some new builds, some parking/land) have
 * `hasScales:false` and an empty `certificates` array — that is not an error.
 */

const DPE_NAME = /performance\s+énerg|(^|\W)dpe(\W|$)/i;
const GES_NAME = /gaz\s+à\s+effet\s+de\s+serre|(^|\W)ges(\W|$)/i;

const VALID_RATINGS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

function normaliseRating(rating) {
    if (!rating) return null;
    const letter = String(rating).trim().toUpperCase();
    return VALID_RATINGS.has(letter) ? letter : null;
}

function readScale(scale) {
    if (!scale) return null;

    const values = asArray(scale.values);
    const consumption = values.find((v) => /consommation/i.test(v?.label || ''));
    const emission = values.find((v) => /émission|emission/i.test(v?.label || ''));

    return {
        rating: normaliseRating(pick(scale, ['efficiencyClass', 'rating'])),
        // 0-based position on the A..G ladder, straight from SeLoger.
        index: pick(scale, ['efficiencyClass', 'index']),
        // Primary energy consumption, kWh/m².an
        consumption: toNumber(consumption?.value),
        consumptionUnit: consumption ? 'kWh/m².an' : null,
        consumptionRaw: consumption?.value ?? null,
        // Greenhouse gas emissions, kg CO2/m².an
        emission: toNumber(emission?.value),
        emissionUnit: emission ? 'kg CO2/m².an' : null,
        emissionRaw: emission?.value ?? null,
        label: scale.name ?? null,
    };
}

/**
 * "entre 1250 et 1730 €/an" -> { min: 1250, max: 1730 }
 * "1 250 €/an"              -> { min: 1250, max: 1250 }
 */
function parseEnergyCost(raw) {
    if (!raw) return { min: null, max: null, currency: 'EUR', raw: null };

    const numbers = String(raw)
        .replace(/[\s   ]/g, '')
        .match(/\d+(?:[.,]\d+)?/g);

    if (!numbers || !numbers.length) return { min: null, max: null, currency: 'EUR', raw };

    const parsed = numbers.map((n) => Number.parseFloat(n.replace(',', '.')));
    return {
        min: parsed[0] ?? null,
        max: parsed[1] ?? parsed[0] ?? null,
        currency: 'EUR',
        raw,
    };
}

export function extractEnergy(classified) {
    const energy = pick(classified, ['sections', 'energy'], {}) || {};
    const certificates = asArray(energy.certificates);
    const scales = certificates.flatMap((certificate) => asArray(certificate.scales));

    // Match on the scale name first; fall back to document order (DPE is always
    // rendered before GES) so an upstream label change does not blank the field.
    let dpeScale = scales.find((s) => DPE_NAME.test(s?.name || ''));
    let gesScale = scales.find((s) => GES_NAME.test(s?.name || ''));
    if (!dpeScale && !gesScale && scales.length) {
        [dpeScale, gesScale] = scales;
    }

    const dpe = readScale(dpeScale);
    const ges = readScale(gesScale);

    // Last-resort DPE letter: the analytics payload carries it separately.
    if (dpe && !dpe.rating) {
        dpe.rating = normaliseRating(pick(classified, ['legacyTracking', 'products', 0, 'energy_letter']));
    }

    const certFeatures = certificates.flatMap((certificate) => asArray(certificate.features));
    const featureValue = (type) => certFeatures.find((f) => f?.type === type)?.value ?? null;
    const energyFeature = (type) => asArray(energy.features).find((f) => f?.type === type)?.value ?? null;

    return {
        // Convenience top-level letters — what most people actually filter on.
        dpe: dpe?.rating ?? null,
        ges: ges?.rating ?? null,
        energyBalance: {
            hasScales: Boolean(energy.hasScales),
            dpe: dpe ?? null,
            ges: ges ?? null,
            estimatedAnnualEnergyCost: parseEnergyCost(featureValue('minMaxEstimation')),
            estimationDescription: featureValue('estimationDescription'),
            diagnosticDate: featureValue('nameOfCertificate'),
            condition: energyFeature('state'),
            heatingSystem: energyFeature('heatingSystem'),
            energySource: energyFeature('energySource'),
        },
    };
}
