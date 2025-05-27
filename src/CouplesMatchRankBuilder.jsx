import { useState } from 'react';
import { programList } from './programList';
import { programMeta } from './programMeta';

export default function CouplesMatchRankBuilder() {
  // State hooks
  const [applicant1Specialty, setApplicant1Specialty] = useState('');
  const [applicant2Specialty, setApplicant2Specialty] = useState('');
  const [applicant1Programs, setApplicant1Programs] = useState([]);
  const [applicant2Programs, setApplicant2Programs] = useState([]);
  const [applicant1LifestyleScores, setApplicant1LifestyleScores] = useState({});
  const [applicant2LifestyleScores, setApplicant2LifestyleScores] = useState({});
  const [applicant1ProgramSelect, setApplicant1ProgramSelect] = useState('');
  const [applicant2ProgramSelect, setApplicant2ProgramSelect] = useState('');
  const [weights, setWeights] = useState({ mutual: 25, proximity: 25, quality: 25, lifestyle: 25 });
  const [pairingScores, setPairingScores] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [rankingMethod, setRankingMethod] = useState('doximity');
  const [applicant1CustomQuality, setApplicant1CustomQuality] = useState({});
const [applicant2CustomQuality, setApplicant2CustomQuality] = useState({});
const totalWeight = Object.values(weights).reduce((sum, val) => sum + val, 0);

const downloadCsv = () => {
  const headers = [
    'Applicant 1 Program',
    'Applicant 2 Program',
    'Composite',
    'Mutual',
    'Proximity',
    'Quality',
    'Lifestyle'
  ];
  const rows = pairingScores.map(p => [
    p.applicant1Program,
    p.applicant2Program,
    p.compositeScore.toFixed(1),
    p.mutualScore.toFixed(1),
    p.proximityScore.toFixed(1),
    p.qualityScore.toFixed(1),
    p.lifestyleScore.toFixed(1)
  ]);
  const csvContent =
    [headers, ...rows]
      .map(r => r.map(val => `"${val}"`).join(','))
      .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'couples_match_rankings.csv';
  a.click();
  URL.revokeObjectURL(url);
};

   // Steps: 1 = build lists, 2 = choose ranking method, 3 = enter lifestyle, 4 = view results

  // Reordering helper: move program up/down
  const moveProgram = (user, program, direction) => {
    const list = user === 1 ? [...applicant1Programs] : [...applicant2Programs];
    const setter = user === 1 ? setApplicant1Programs : setApplicant2Programs;
    const idx = list.indexOf(program);
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return;
    [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
    setter(list);
  };

  // Scoring functions
  const calculateMutualPreferenceScore = (rank1, rank2, len1, len2) => {
    // convert each rank into a [0…1] percentile (1 = top choice, 0 = last choice)
    const pct1 = len1 > 1 ? 1 - (rank1 - 1) / (len1 - 1) : 1;
    const pct2 = len2 > 1 ? 1 - (rank2 - 1) / (len2 - 1) : 1;
  
    // average the two percentiles and scale to [0…100]
    return ((pct1 + pct2) / 2) * 100;
  };  
  const calculateLifestyleFitScore = (s1, s2) => Math.max(0, Math.min(100, (s1 + s2) / 2));
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8;
    const toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R*c;
  };
  const calculateQualityScore = (r1, r2, max=300) => {
    const adj = x => x==null?max*1.25:x;
    const avg = (adj(r1)+adj(r2))/2;
    return Math.max(0, Math.min(100, (1 - avg/(max*1.25))*100));
  };
  const calculateCompositeScore = (scores, w) => {
    const totalW = Object.values(w).reduce((a,b)=>a+b,0);
    const sum = scores.mutual*w.mutual + scores.proximity*w.proximity + scores.quality*w.quality + scores.lifestyle*w.lifestyle;
    return sum/totalW;
  };

  // Generate composite scores
  const generateCompositeScores = () => {
    console.log("🔍 generateCompositeScores fired");
// 1️⃣ Build an array of all distances
const allDistances = [];
applicant1Programs.forEach(({ name: p1, specialty: spec1 }) => {
  applicant2Programs.forEach(({ name: p2, specialty: spec2 }) => {
    const key1 = `${spec1}::${p1}`;
    const key2 = `${spec2}::${p2}`;
    const meta1 = programMeta[key1];
    const meta2 = programMeta[key2];
    if (meta1 && meta2) {
      const d = calculateDistance(meta1.lat, meta1.lon, meta2.lat, meta2.lon);
      allDistances.push(d);
    }
  });
});

// before computing min/max
if (allDistances.length === 0) {
  setPairingScores([]);  // or you could simply return if you prefer not to clear
  return;
}

// 2️⃣ Find the closest and farthest distances in this batch
const minDist = Math.min(...allDistances);
const maxDist = Math.max(...allDistances);

const results = [];
applicant1Programs.forEach(({ name: p1, specialty: spec1 }, i1) => {
  applicant2Programs.forEach(({ name: p2, specialty: spec2 }, i2) => {
    const key1 = `${spec1}::${p1}`;
    const key2 = `${spec2}::${p2}`;
    const meta1 = programMeta[key1];
    const meta2 = programMeta[key2];

    const mutual = calculateMutualPreferenceScore(
      i1 + 1,
      i2 + 1,
      applicant1Programs.length,
      applicant2Programs.length
    );
    const lifestyle = calculateLifestyleFitScore(
      applicant1LifestyleScores[p1] ?? 50,
      applicant2LifestyleScores[p2] ?? 50
    );

    let proximity = 0;
    if (meta1 && meta2) {
      const dist = calculateDistance(
        meta1.lat, meta1.lon,
        meta2.lat, meta2.lon
      );
      proximity =
        maxDist === minDist
          ? 100
          : Math.round(
              Math.max(
                0,
                Math.min(
                  100,
                  ((maxDist - dist) / (maxDist - minDist)) * 100
                )
              )
            );
    }

let quality;
if (rankingMethod === 'doximity') {
  quality = calculateQualityScore(meta1?.rank, meta2?.rank);
} else {
  // fall back to 50 if user didn’t enter anything
  const q1 = applicant1CustomQuality[p1] ?? 50;
  const q2 = applicant2CustomQuality[p2] ?? 50;
  quality = Math.max(0, Math.min(100, (q1 + q2) / 2));
}
    const composite = calculateCompositeScore(
      { mutual, proximity, quality, lifestyle },
      weights
    );

    results.push({
      applicant1Program: p1,
      applicant2Program: p2,
      compositeScore: composite,
      mutualScore: mutual,
      proximityScore: proximity,
      qualityScore: quality,
      lifestyleScore: lifestyle
    });
  });
});
setPairingScores(results.sort((a, b) => b.compositeScore - a.compositeScore)); 
};

  // Delete a program
  const handleDeleteProgram = (user, prog) => {
    if(user===1){ setApplicant1Programs(prev=>prev.filter(p=>p!==prog)); setApplicant1LifestyleScores(prev=>{ const u={...prev}; delete u[prog]; return u; }); }
    else { setApplicant2Programs(prev=>prev.filter(p=>p!==prog)); setApplicant2LifestyleScores(prev=>{ const u={...prev}; delete u[prog]; return u; }); }
  };

  // Adjust weights
  const handleWeightChange = (key, val) => {
    const u={...weights,[key]:+val}; if(Object.values(u).reduce((a,b)=>a+b,0)<=100) setWeights(u);
  };
  const specialties = Object.keys(programList);

// before your return, define per-step validity:
const isStep1Valid = applicant1Programs.length > 0 && applicant2Programs.length > 0;
const isStep2Valid = rankingMethod === 'doximity' ||
                     (applicant1Programs.every(p => typeof applicant1CustomQuality[p.name] === 'number') &&
                      applicant2Programs.every(p => typeof applicant2CustomQuality[p.name] === 'number'));
const isStep3Valid = Object.keys(applicant1LifestyleScores).length === applicant1Programs.length &&
                     Object.keys(applicant2LifestyleScores).length === applicant2Programs.length;
const isStep4Valid = totalWeight > 0 && totalWeight <= 100;
// (step 5 is just the results, no guard)

// how far can they go?
const maxUnlockedStep = 
  currentStep === 0 ? 1
: currentStep === 1 ? (isStep1Valid ? 2 : 1)
: currentStep === 2 ? (isStep2Valid ? 3 : 2)
: currentStep === 3 ? (isStep3Valid ? 4 : 3)
: currentStep === 4 ? (isStep4Valid ? 5 : 4)
: 6;

// build a flat list of every pair's raw distance
const proximityData = applicant1Programs.flatMap(({ name: p1, specialty: s1 }, i1) =>
  applicant2Programs.map(({ name: p2, specialty: s2 }, i2) => {
    const meta1 = programMeta[`${s1}::${p1}`];
    const meta2 = programMeta[`${s2}::${p2}`];
    const dist = meta1 && meta2
      ? calculateDistance(meta1.lat, meta1.lon, meta2.lat, meta2.lon)
      : null;
    return { p1, p2, dist, i1, i2 };
  })
).filter(d => d.dist !== null);

const allDists = proximityData.map(d => d.dist);
const minDist = allDists.length ? Math.min(...allDists) : 0;
const maxDist = allDists.length ? Math.max(...allDists) : 0;

// now we start our JSX
return (
 <div className="p-4 space-y-6">
    {/* STEP 0 – Welcome */}
    {currentStep === 0 && (
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h2 className="text-3xl font-bold">
      Welcome to the Couples Match Rank Generator
    </h2>

    <p className="text-gray-600">
      This tool helps two applicants build a joint residency rank list in five easy steps:
    </p>
    <ol className="list-decimal list-inside mt-2 text-left text-gray-600">
  <li>Create each individual’s rank list</li>
  <li>Review geographic proximity</li>
  <li>Choose how to score program quality</li>
  <li>Assign lifestyle fit scores</li>
  <li>Adjust component weights</li>
  <li>View your combined composite rankings</li>
</ol>


    <button
      onClick={() => setCurrentStep(1)}
      className="mt-4 bg-green-600 text-white px-6 py-2 rounded"
    >
      Get Started →
    </button>
      </div>
    )}

    {/* EVERYTHING ELSE (steps 1–5) */}
    {currentStep > 0 && (
  <div>
       {/* ── PROGRESS BAR ── */}
       <progress
      className="w-full h-2 mb-4"
      value={currentStep}
      max={6}      // or whatever your total step count is
    />

  {/* ── NAV TABS ── */}
<div className="flex justify-center space-x-2 mb-6">
  {[
    'Individual Rank Lists',
    'Geographic Proximity',
    'Determine Program Quality',
    'Lifestyle Fit',
    'Adjust Weights',
    'Results'
  ].map((label, idx) => {
    const step = idx + 1;
    const unlocked = step <= maxUnlockedStep;
    return (
      <button
        key={step}
        onClick={() => unlocked && setCurrentStep(step)}
        disabled={!unlocked}
        className={`
          flex items-center space-x-1 rounded-full px-3 py-1 transition
          ${ unlocked
            ? (currentStep === step ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
            : 'opacity-50 cursor-not-allowed'
          }
        `}
      >
        <span className="font-semibold">{step}</span>
        <span className="text-sm">{label}</span>
      </button>
    );
  })}
</div>


  <h1 className="text-3xl font-bold mb-6">
    Residency Couples Match Rank List Generator
  </h1>


       {/* STEP 1 – Build Lists */}
{currentStep === 1 && (
  <div className="space-y-4">
    <p className="text-gray-600 mb-4">
      Create each applicant’s personal rank list. Select a specialty, then add and order programs by preference.
    </p>

    {/* Specialty & Program Selectors */}
    <div className="grid grid-cols-2 gap-8">
      {/* applicant 1 panel */}
      <div>
        <h2 className="text-xl font-semibold">Applicant 1 – Select Specialty</h2>
        <select
          value={applicant1Specialty}
          onChange={e => setApplicant1Specialty(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">-- Select Specialty --</option>
          {specialties.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {applicant1Specialty && (
          <>
            <div className="mt-2 flex gap-2">
              <select
                value={applicant1ProgramSelect}
                onChange={e => setApplicant1ProgramSelect(e.target.value)}
                className="flex-1 border p-2 rounded"
              >
                <option value="">-- Select Program --</option>
                {[...programList[applicant1Specialty]]
  .sort((a, b) => a.localeCompare(b))
  .map(p => (
    <option key={p} value={p}>{p}</option>
  ))
}

              </select>
              <button
                onClick={() => {
                  if (
                    applicant1ProgramSelect &&
                    !applicant1Programs.some(
                      prog =>
                        prog.name === applicant1ProgramSelect &&
                        prog.specialty === applicant1Specialty
                    )
                  ) {
                    setApplicant1Programs(prev => [
                      ...prev,
                      { name: applicant1ProgramSelect, specialty: applicant1Specialty }
                    ]);
                  }
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {applicant1Programs.map((p, idx) => (
                <div
                  key={`${p.specialty}::${p.name}::${idx}`}
                  className="flex items-center gap-2"
                >
                  <span className="w-6">{idx + 1}.</span>
                  <span className="flex-1">{p.name} ({p.specialty})</span>
                  <button
                    onClick={() => moveProgram(1, p, 'up')}
                    disabled={idx === 0}
                    className="px-1"
                  >▲</button>
                  <button
                    onClick={() => moveProgram(1, p, 'down')}
                    disabled={idx === applicant1Programs.length - 1}
                    className="px-1"
                  >▼</button>
                  <button
                    onClick={() => handleDeleteProgram(1, p)}
                    className="text-red-500"
                  >❌</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* applicant 2 panel */}
      <div>
        <h2 className="text-xl font-semibold">Applicant 2 – Select Specialty</h2>
        <select
          value={applicant2Specialty}
          onChange={e => setApplicant2Specialty(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">-- Select Specialty --</option>
          {specialties.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {applicant2Specialty && (
          <>
            <div className="mt-2 flex gap-2">
              <select
                value={applicant2ProgramSelect}
                onChange={e => setApplicant2ProgramSelect(e.target.value)}
                className="flex-1 border p-2 rounded"
              >
                <option value="">-- Select Program --</option>
                {[...programList[applicant2Specialty]]
  .sort((a, b) => a.localeCompare(b))
  .map(p => (
    <option key={p} value={p}>{p}</option>
  ))
}
              </select>
              <button
                onClick={() => {
                  if (
                    applicant2ProgramSelect &&
                    !applicant2Programs.some(
                      prog =>
                        prog.name === applicant2ProgramSelect &&
                        prog.specialty === applicant2Specialty
                    )
                  ) {
                    setApplicant2Programs(prev => [
                      ...prev,
                      { name: applicant2ProgramSelect, specialty: applicant2Specialty }
                    ]);
                  }
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {applicant2Programs.map((p, idx) => (
                <div
                  key={`${p.specialty}::${p.name}::${idx}`}
                  className="flex items-center gap-2"
                >
                  <span className="w-6">{idx + 1}.</span>
                  <span className="flex-1">{p.name} ({p.specialty})</span>
                  <button
                    onClick={() => moveProgram(2, p, 'up')}
                    disabled={idx === 0}
                    className="px-1"
                  >▲</button>
                  <button
                    onClick={() => moveProgram(2, p, 'down')}
                    disabled={idx === applicant2Programs.length - 1}
                    className="px-1"
                  >▼</button>
                  <button
                    onClick={() => handleDeleteProgram(2, p)}
                    className="text-red-500"
                  >❌</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>

    {/* Next button */}
    <div className="mt-6 flex justify-end">
      <button
        onClick={() => setCurrentStep(2)}
        disabled={applicant1Programs.length === 0 || applicant2Programs.length === 0}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Next: Geographic Proximity →
      </button>
    </div>
  </div>
)}


{/* STEP 2 – Geographic Proximity */}

{currentStep === 2 && (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Step 2 – Geographic Proximity</h2>
    <p className="text-gray-600">
      Here we normalize every program-to-program distance to a 0–100 scale.
    </p>

    <table className="min-w-full border text-center">
      <thead className="bg-gray-200">
        <tr>
          <th className="border px-4 py-2">#</th>
          <th className="border px-4 py-2">Applicant 1 Program</th>
          <th className="border px-4 py-2">Applicant 2 Program</th>
          <th className="border px-4 py-2">Raw Distance (mi)</th>
          <th className="border px-4 py-2">Proximity Score</th>
        </tr>
      </thead>
      <tbody>
        {proximityData.map(({ p1, p2, dist }, idx) => {
          const proximityScore =
            maxDist === minDist
              ? 100
              : ((maxDist - dist) / (maxDist - minDist)) * 100;
          return (
            <tr key={idx}>
              <td className="border px-4 py-2">{idx + 1}</td>
              <td className="border px-4 py-2">{p1}</td>
              <td className="border px-4 py-2">{p2}</td>
              <td className="border px-4 py-2">{dist.toFixed(1)}</td>
              <td className="border px-4 py-2">{proximityScore.toFixed(1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>

    <div className="mt-6 flex justify-between">
      <button onClick={() => setCurrentStep(1)} className="bg-gray-300 px-4 py-2 rounded">
        ← Back
      </button>
      <button
        onClick={() => setCurrentStep(3)}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Next: Determine Program Quality →
      </button>
    </div>
  </div>
)}


        {/* STEP 3 – Choose Ranking Method */}
{currentStep === 3 && (
  <div className="space-y-4">
    <p className="text-gray-600">
      Choose how you want to score program quality. Use Doximity ratings or enter your own custom quality scores.
    </p>
    <h2 className="text-xl font-semibold">Step 2 – Choose Ranking Method</h2>

    {/* ── Ranking Method Radios ── */}
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="rankingMethod"
          value="doximity"
          checked={rankingMethod === 'doximity'}
          onChange={() => setRankingMethod('doximity')}
        />
        Use Doximity Program Quality
        <span
          className="ml-1 cursor-help"
          title="We’ll pull each program’s Doximity rank from our data and convert it to a 0–100 score."
        >
          ℹ️
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="rankingMethod"
          value="custom"
          checked={rankingMethod === 'custom'}
          onChange={() => setRankingMethod('custom')}
        />
        Enter Custom Quality Scores
        <span
          className="ml-1 cursor-help"
          title="Type your own 0–100 quality score for each program in the list below."
        >
          ℹ️
        </span>
      </label>
    </div>

    {rankingMethod === 'doximity' && (
      <div className="mt-4">
        <h3 className="font-semibold">Doximity Ranks Preview</h3>
        <div className="grid grid-cols-2 gap-4 text-gray-700">
          <div>
            <h4 className="underline">Applicant 1</h4>
            <ul className="list-disc list-inside">
              {applicant1Programs.map(p => (
                <li key={p.name}>
                  {p.name}: {programMeta[`${p.specialty}::${p.name}`]?.rank ?? 'N/A'}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="underline">Applicant 2</h4>
            <ul className="list-disc list-inside">
              {applicant2Programs.map(p => (
                <li key={p.name}>
                  {p.name}: {programMeta[`${p.specialty}::${p.name}`]?.rank ?? 'N/A'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )}

    {rankingMethod === 'custom' && (
      <div className="grid grid-cols-2 gap-8 mt-4">
        <div>
          <h3 className="font-semibold">Applicant 1 – Custom Quality</h3>
          {applicant1Programs.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 my-1">
              <span className="w-6">{idx + 1}.</span>
              <span className="flex-1">{p.name}</span>
              <input
                type="number"
                placeholder="0–100"
                className="border p-1 rounded w-24"
                value={applicant1CustomQuality[p.name] ?? ''}
                onChange={e =>
                  setApplicant1CustomQuality(prev => ({
                    ...prev,
                    [p.name]: Math.min(100, Math.max(0, +e.target.value))
                  }))
                }
              />
            </div>
          ))}
        </div>

        <div>
          <h3 className="font-semibold">Applicant 2 – Custom Quality</h3>
          {applicant2Programs.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 my-1">
              <span className="w-6">{idx + 1}.</span>
              <span className="flex-1">{p.name}</span>
              <input
                type="number"
                placeholder="0–100"
                className="border p-1 rounded w-24"
                value={applicant2CustomQuality[p.name] ?? ''}
                onChange={e =>
                  setApplicant2CustomQuality(prev => ({
                    ...prev,
                    [p.name]: Math.min(100, Math.max(0, +e.target.value))
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Navigation Buttons */}
    <div className="mt-6 flex justify-between">
      <button
        onClick={() => setCurrentStep(1)}
        className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
      >
        ← Back
      </button>
      <button
        onClick={() => setCurrentStep(4)}
        disabled={!isStep2Valid}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Next: Lifestyle Fit →
      </button>
    </div>
  </div>
)}


        {/* STEP 4 – Enter Lifestyle Fit Scores */}
{currentStep === 4 && (
  <div className="space-y-4">
    <p className="text-gray-600">
      Assign lifestyle fit scores (0–100) for each program for both applicants to reflect personal priorities.
    </p>
    <h2 className="text-xl font-semibold flex items-center">
      Step 3 – Enter Lifestyle Fit Scores
      <span
        className="ml-2 cursor-help"
        title="Rate how well each program matches your personal/lifestyle priorities (0 = worst, 100 = best)."
      >
        ℹ️
      </span>
    </h2>

    <div className="grid grid-cols-2 gap-8">
      {/* Applicant 1 */}
      <div>
        <h3 className="font-semibold">Applicant 1 Programs</h3>
        {applicant1Programs.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2 my-1">
            <span className="w-6">{idx + 1}.</span>
            <span className="flex-1">{p.name}</span>
            <input
              type="number"
              placeholder="0–100"
              className="border p-1 rounded w-24"
              value={applicant1LifestyleScores[p.name] ?? ''}
              onChange={e =>
                setApplicant1LifestyleScores(prev => ({
                  ...prev,
                  [p.name]: +e.target.value
                }))
              }
            />
          </div>
        ))}
      </div>

      {/* Applicant 2 */}
      <div>
        <h3 className="font-semibold">Applicant 2 Programs</h3>
        {applicant2Programs.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2 my-1">
            <span className="w-6">{idx + 1}.</span>
            <span className="flex-1">{p.name}</span>
            <input
              type="number"
              placeholder="0–100"
              className="border p-1 rounded w-24"
              value={applicant2LifestyleScores[p.name] ?? ''}
              onChange={e =>
                setApplicant2LifestyleScores(prev => ({
                  ...prev,
                  [p.name]: +e.target.value
                }))
              }
            />
          </div>
        ))}
      </div>
    </div>

    {/* Navigation */}
    <div className="mt-6 flex justify-between">
      <button
        onClick={() => setCurrentStep(2)}
        className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
      >
        ← Back
      </button>
      <button
        onClick={() => setCurrentStep(5)}
        disabled={
          Object.keys(applicant1LifestyleScores).length !== applicant1Programs.length ||
          Object.keys(applicant2LifestyleScores).length !== applicant2Programs.length
        }
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Next: Adjust Weights →
      </button>
    </div>
  </div>
)}


        {/* STEP 5 – Adjust Weights */}
{currentStep === 5 && (
  <div className="space-y-4">
    <p className="text-gray-600">
      Now decide how much each component should count toward your final ranking.
    </p>
    <h2 className="text-xl font-semibold">Step 4 – Adjust Weights</h2>

    {/* ── Weight Sliders ── */}
    <div className="mt-4 space-y-2">
      <h3 className="font-semibold">Component Weights (sum ≤ 100%)</h3>
      {Object.entries(weights).map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <label className="capitalize w-24 flex items-center">
            {key}
            <span
              className="ml-1 cursor-help"
              title={{
                mutual: "How closely your two individual program rankings align — 100 means both ranked it first.",
                proximity: "Programs closer together score higher: distances are normalized so the furthest pair is 0.",
                quality: "Based on Doximity rank (lower rank → higher score), or your custom 0–100 input.",
                lifestyle: "Your personal ‘fit’ score for each program — 0 worst, 100 best."
              }[key]}
            >
              ℹ️
            </span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={val}
            onChange={e => handleWeightChange(key, e.target.value)}
            className="border p-1 rounded w-16"
          />
          <span>%</span>
        </div>
      ))}
    </div>

    {/* Navigation */}
    <div className="mt-6 flex justify-between">
      <button
        onClick={() => setCurrentStep(3)}
        className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
      >
        ← Back
      </button>
      <button
        onClick={() => {
          generateCompositeScores();
          setCurrentStep(6);
        }}
        disabled={totalWeight === 0 || totalWeight > 100}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Next: View Results →
      </button>
    </div>
  </div>
)}


{/* STEP 6 – Composite Scores */}
{currentStep === 6 && pairingScores.length > 0 && (
  <div className="mt-6 space-y-4">
    {/* Download CSV */}
    <button
      onClick={downloadCsv}
      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
    >
      Download CSV
    </button>

    {/* Summary */}
    <p className="text-gray-600 mb-4">
      Here are your composite match scores, blending each applicant’s preferences, geographic proximity, program quality, and lifestyle fit.
    </p>

    {/* Heading */}
    <h2 className="text-2xl font-semibold mb-4">Step 5 – Composite Scores</h2>

    {/* Back & Restart */}
    <div className="mb-6 flex justify-between">
      <button
        onClick={() => setCurrentStep(4)}
        className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
      >
        ← Back
      </button>
      <button
        onClick={() => {
          setCurrentStep(0);
          setApplicant1Programs([]);
          setApplicant2Programs([]);
          setPairingScores([]);
        }}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Start Over
      </button>
    </div>

    {/* Results table */}
    <table className="min-w-full border text-center">
      <thead className="bg-gray-200">
        <tr>
          <th className="border px-4 py-2">#</th>
          <th className="border px-4 py-2">Applicant 1 Program</th>
          <th className="border px-4 py-2">Applicant 2 Program</th>
          <th className="border px-4 py-2">Composite Score</th>
          <th className="border px-4 py-2">Mutual Preference</th>
          <th className="border px-4 py-2">Proximity</th>
          <th className="border px-4 py-2">Quality</th>
          <th className="border px-4 py-2">Lifestyle Fit</th>
        </tr>
      </thead>
      <tbody>
        {pairingScores.map((pair, i) => (
          <tr key={i}>
            <td className="border px-4 py-2">{i + 1}</td>
            <td className="border px-4 py-2">{pair.applicant1Program}</td>
            <td className="border px-4 py-2">{pair.applicant2Program}</td>
            <td className="border px-4 py-2">{pair.compositeScore.toFixed(1)}</td>
            <td className="border px-4 py-2">{pair.mutualScore.toFixed(1)}</td>
            <td className="border px-4 py-2">{pair.proximityScore.toFixed(1)}</td>
            <td className="border px-4 py-2">{pair.qualityScore.toFixed(1)}</td>
            <td className="border px-4 py-2">{pair.lifestyleScore.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

      </div>
    )}
  </div>
);
}