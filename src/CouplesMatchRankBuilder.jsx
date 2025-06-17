import { useState, useEffect } from 'react';
import { programList } from './programList';
import { programMeta } from './programMeta';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

function SortableItem({ id, children, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
       <div
         ref={setNodeRef}
         style={{ transform: CSS.Transform.toString(transform), transition }}
         className="
           flex  
           flex-row         /* force row layout */
           items-center     /* vertical center */
           justify-between  /* handle far left, delete far right */
           p-2
           border
           rounded
           whitespace-nowrap /* prevent wrapping */
         "
       >
      {/* drag handle */}
      <span {...attributes} {...listeners} className="cursor-grab select-none">
        ☰
      </span>

          {/* your label */}
    <span className="mx-2 flex-1 truncate">
      {children}
    </span>

      {/* delete button */}
      <button onClick={onDelete} className="text-red-500">
        ❌
      </button>
    </div>
  );
}
  function handleDragEndQuality(event, user) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
  
    const [list, setList] =
      user === 1
        ? [applicant1QualityOrder, setApplicant1QualityOrder]
        : [applicant2QualityOrder, setApplicant2QualityOrder];
  
    const oldIndex = list.findIndex(p => p.id === active.id);
    const newIndex = list.findIndex(p => p.id === over.id);
    setList(current => arrayMove(current, oldIndex, newIndex));
  }

  function SvgCurvePreview({ exponent, maxDist }) {
    // don't attempt to draw until we have at least one distance
    if (maxDist === 0) {
      return (
        <div className="w-full h-32 flex items-center justify-center text-gray-500">
          Add at least two programs to see the curve
        </div>
      );
    }
  
    // generate 50 points
    const points = Array.from({ length: 51 }, (_, i) => {
      const x = (i / 50) * maxDist;
      const norm = (maxDist - x) / maxDist;    // now maxDist > 0
      const y = Math.pow(norm, exponent) * 100;
      return { x, y };
    });
  
    const d = points
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x},${100 - pt.y}`)
      .join(" ");
  
    return (
      <svg
        viewBox={`0 0 ${maxDist} 100`}
        style={{ width: "100%", height: 120, border: "1px solid #ccc" }}
      >
        <path d={d} fill="none" stroke="#3182CE" strokeWidth="1.5" />
        <line x1="0" y1="100" x2={maxDist} y2="100" stroke="#999" strokeWidth="0.5" />
        <line x1="0" y1="0"   x2="0"     y2="100" stroke="#999" strokeWidth="0.5" />
        <text x={maxDist} y={115} fontSize="8" textAnchor="end">
          Distance →
        </text>
        <text
          x={-5}
          y="0"
          fontSize="8"
          textAnchor="end"
          transform="rotate(-90 -5,0)"
        >
          Prox %
        </text>
      </svg>
    );
  }  

export default function CouplesMatchRankBuilder() {
  // State hooks
  const [applicant1Specialty, setApplicant1Specialty] = useState('');
  const [applicant2Specialty, setApplicant2Specialty] = useState('');
  const [applicant1Programs, setApplicant1Programs] = useState([]);
  const [applicant2Programs, setApplicant2Programs] = useState([]);
  const [cityRatings, setCityRatings] = useState({});
  const [applicant1ProgramSelect, setApplicant1ProgramSelect] = useState('');
  const [applicant2ProgramSelect, setApplicant2ProgramSelect] = useState('');
  const [proximityExponent, setProximityExponent] = useState(2);
  const [weights, setWeights] = useState({ mutual: 30, proximity: 40, quality: 20, lifestyle: 10 });
  const [pairingScores, setPairingScores] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [applicant1QualityOrder, setApplicant1QualityOrder] = useState([]);
  const [applicant2QualityOrder, setApplicant2QualityOrder] = useState([]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );    

const handleDragEndPrograms = (event, user) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const list   = user === 1 ? applicant1Programs : applicant2Programs;
  const setter = user === 1 ? setApplicant1Programs : setApplicant2Programs;

  const oldIndex = list.findIndex(item => item.id === active.id);
  const newIndex = list.findIndex(item => item.id === over.id);
  setter(items => arrayMove(items, oldIndex, newIndex));
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
};

const calculateMutualPreferenceScore = (rank1, rank2, len1, len2) => {
  const pct1 = len1 > 1 ? 1 - (rank1 - 1) / (len1 - 1) : 1;
  const pct2 = len2 > 1 ? 1 - (rank2 - 1) / (len2 - 1) : 1;
  return ((pct1 + pct2) / 2) * 100;
}; 
  const calculateLifestyleFitScore = (s1, s2) => Math.max(0, Math.min(100, (s1 + s2) / 2));
  const calculateCompositeScore = (scores, w) => {
    const totalW = Object.values(w).reduce((a,b)=>a+b,0);
    const sum = scores.mutual*w.mutual + scores.proximity*w.proximity + scores.quality*w.quality + scores.lifestyle*w.lifestyle;
    return sum/totalW;
  };

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
const maxDist   = allDists.length ? Math.max(...allDists) : 0;

useEffect(() => {
  // only run when maxDist actually changes
  if (maxDist === 0) return;
  if (maxDist >= 2000) setProximityExponent(4);
  else if (maxDist >= 1000) setProximityExponent(3);
  else setProximityExponent(2);
}, [maxDist]);

// Recompute proximity rows on every exponent change:
const proximityRows = proximityData
  .map(({ p1, p2, dist }) => {
    const norm = maxDist === minDist
      ? 1
      : Math.max(0, Math.min(1, (maxDist - dist) / (maxDist - minDist)));
    const score = Math.round(Math.pow(norm, proximityExponent) * 100);
    return { p1, p2, dist, proximityScore: score };
  })
  .sort((a, b) => b.proximityScore - a.proximityScore);

  // inside CouplesMatchRankBuilder, above the return
const handleDragEndQuality = (event, user) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  // pick the right list + setter
  const list   = user === 1 ? applicant1QualityOrder : applicant2QualityOrder;
  const setter = user === 1 ? setApplicant1QualityOrder  : setApplicant2QualityOrder;

  const oldIndex = list.findIndex(item => item.id === active.id);
  const newIndex = list.findIndex(item => item.id === over.id);
  setter(items => arrayMove(items, oldIndex, newIndex));
};

    // ── SYNC QUALITY ORDER TO PROGRAM LISTS ──
    useEffect(() => {
      if (currentStep === 3) {
        // initialize quality orders from the personal lists, but only once
        setApplicant1QualityOrder([...applicant1Programs]);
        setApplicant2QualityOrder([...applicant2Programs]);
      }
    }, [currentStep]);  // watch only the step, not the program lists
  
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
// Reordering helper: move program within quality-order lists
const moveProgramQuality = (user, idx, dir) => {
  const list = user === 1
    ? [...applicant1QualityOrder]
    : [...applicant2QualityOrder];
  const swapWith = dir === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return;
  [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
  user === 1
    ? setApplicant1QualityOrder(list)
    : setApplicant2QualityOrder(list);
};

  const allCities = Array.from(new Set(
    [...applicant1Programs, ...applicant2Programs]
      .map(({ name, specialty }) => {
        const { city, state } = programMeta[`${specialty}::${name}`] || {};
        return city && state ? `${city}, ${state}` : null;
      })
      .filter(Boolean)
  ));


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
   // lookup city of p1 (either program; same city for both applicants)
const { city, state } = programMeta[key1];
const cityState = `${city}, ${state}`;
const rating = cityRatings[cityState] ?? 5;    // default to 5 if somehow missing
const lifestyle = Math.min(100, Math.max(10, rating * 10));


    let proximity = 0;
    if (meta1 && meta2) {
      const dist = calculateDistance(
        meta1.lat, meta1.lon,
        meta2.lat, meta2.lon
      );
      if (maxDist === minDist) {
               proximity = 100;
             } else {
               // 1) normalize to [0…1]
               const norm = Math.max(
                 0,
                 Math.min(1, (maxDist - dist) / (maxDist - minDist))
               );
               // 2) apply exponent for a steeper curve
               const exponent = proximityExponent;      // try 2, 3, etc.
               // 3) scale back to 0–100
               proximity = Math.round(Math.pow(norm, exponent) * 100);
             }
    }
// find index in quality-order; convert to [0…1] percentile
const q1 = applicant1QualityOrder.findIndex(p=>p.name===p1);
const q2 = applicant2QualityOrder.findIndex(p=>p.name===p2);
const pct1 = q1>=0 && applicant1QualityOrder.length>1
  ? 1 - q1/(applicant1QualityOrder.length-1)
  : 1;
const pct2 = q2>=0 && applicant2QualityOrder.length>1
  ? 1 - q2/(applicant2QualityOrder.length-1)
  : 1;
const quality = ((pct1 + pct2)/2) * 100;

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
    if(user===1){ setApplicant1Programs(prev=>prev.filter(p=>p!==prog));  }
    else { setApplicant2Programs(prev=>prev.filter(p=>p!==prog));  }
  };

  // Adjust weights
  const handleWeightChange = (key, val) => {
    const u={...weights,[key]:+val}; if(Object.values(u).reduce((a,b)=>a+b,0)<=100) setWeights(u);
  };
  const specialties = Object.keys(programList);

// before your return, define per-step validity:
const isStep1Valid = applicant1Programs.length > 0 && applicant2Programs.length > 0;
const isStep2Valid = applicant1Programs.length > 0 && applicant2Programs.length > 0;
const isStep3Valid =
  applicant1QualityOrder.length === applicant1Programs.length &&
  applicant2QualityOrder.length === applicant2Programs.length;
  const isStep4Valid = allCities.every(city => typeof cityRatings[city] === 'number');
  // (step 5 is just the results, no guard)

// how far can they go?
const maxUnlockedStep = 
  currentStep === 0 ? 1
: currentStep === 1 ? (isStep1Valid ? 2 : 1)
: currentStep === 2 ? (isStep2Valid ? 3 : 2)
: currentStep === 3 ? (isStep3Valid ? 4 : 3)
: currentStep === 4 ? (isStep4Valid ? 5 : 4)
: 6;

// sort from highest-to-lowest proximity score
const sortedProximity = proximityData
  .map(({ p1, p2, dist }) => {
    const proximityScore =
      maxDist === minDist
        ? 100
        : ((maxDist - dist) / (maxDist - minDist)) * 100;
    return { p1, p2, dist, proximityScore };
  })
  .sort((a, b) => b.proximityScore - a.proximityScore);

  // just inside your component, before the return:
  const labels = {
    mutual:    { title: 'Mutual Preference',    desc: 'The impact of your individual rank list.' },
    proximity: { title: 'Geographic Proximity', desc: 'The impact of program closeness.' },
    quality:   { title: 'Program Quality',      desc: 'The impact of your ranking based solely on program quality.' },
    lifestyle: { title: 'Lifestyle Fit',        desc: 'The impact of your 1–10 city rating.' },
  };
  


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
                    const id = `${applicant1Specialty}::${applicant1ProgramSelect}`;
                    setApplicant1Programs(prev => [
                      ...prev,
                      { id, name: applicant1ProgramSelect, specialty: applicant1Specialty }
                    ]);
                    
                  }
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                Add
              </button>
            </div>

            {/* after you add the “Add” button, instead of your <div className="mt-4 space-y-2">… */}
            <DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={evt => handleDragEndPrograms(evt, 1)}
>
  <SortableContext
    items={applicant1Programs.map(p => p.id)}
    strategy={verticalListSortingStrategy}
  >
    {applicant1Programs.map((p, idx) => (
      <SortableItem
        key={p.id}
        id={p.id}
        onDelete={() =>
          setApplicant1Programs(ps => ps.filter(x => x.id !== p.id))
        }
      >
        {`${idx + 1}. ${p.name}`}
      </SortableItem>
    ))}
  </SortableContext>
</DndContext>

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
                    const id = `${applicant2Specialty}::${applicant2ProgramSelect}`;
                    setApplicant2Programs(prev => [
                      ...prev,
                      { id, name: applicant2ProgramSelect, specialty: applicant2Specialty }
                    ]);
                    
                  }
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                Add
              </button>
            </div>

            {/* after you add the “Add” button, instead of your <div className="mt-4 space-y-2">… */}
            <DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={evt => handleDragEndPrograms(evt, 2)}
>
  <SortableContext
    items={applicant2Programs.map(p => p.id)}
    strategy={verticalListSortingStrategy}
  >
    {applicant2Programs.map((p, idx) => (
      <SortableItem
        key={p.id}
        id={p.id}
        onDelete={() =>
          setApplicant2Programs(ps => ps.filter(x => x.id !== p.id))
        }
      >
        {`${idx + 1}. ${p.name}`}
      </SortableItem>
    ))}
  </SortableContext>
</DndContext>




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
  <div className="space-y-6">
    <h2 className="text-xl font-semibold">Step 2 – Geographic Proximity</h2>
    <p className="text-gray-600">
      Here we normalize every program-to-program distance to a 0–100 scale.
    </p>

    {/* exponent selector + tip + curve preview */}
    <div className="p-4 bg-gray-50 rounded space-y-4">
      <label className="block font-semibold">
        Distance Exponent: <span className="font-mono">{proximityExponent}</span>
      </label>
      <input
        type="range"
        min={1}
        max={6}
        step={0.1}
        value={proximityExponent}
        onChange={e => setProximityExponent(+e.target.value)}
        className="w-full"
      />
<p className="text-sm text-gray-600">
  The exponent is initially selected for you based on your farthest-apart programs, but feel free to tweak it with the slider.
</p>
<p className="text-sm text-gray-600">
  <strong>Recommendation:</strong>  
  If your furthest programs are over 2,000 mi apart, use a higher exponent (3–5) to exaggerate small differences between closer programs.  
  If they’re all within ~500 mi, a lower exponent (1–2) may suffice. The goal = a proximity score that changes even with small changes in raw distance.
</p>


      <SvgCurvePreview exponent={proximityExponent} maxDist={maxDist}/>      </div>

    {/* the sorted table */}
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
      {proximityRows.map(({ p1, p2, dist, proximityScore }, idx) => (
  <tr key={`${p1}-${p2}`}>
    <td className="border px-4 py-2">{idx + 1}</td>
    <td className="border px-4 py-2">{p1}</td>
    <td className="border px-4 py-2">{p2}</td>
    <td className="border px-4 py-2">{dist.toFixed(1)}</td>
    <td className="border px-4 py-2">{proximityScore}</td>
  </tr>
))}
      </tbody>
    </table>

    <div className="mt-6 flex justify-between">
      <button
        onClick={() => setCurrentStep(1)}
        className="bg-gray-300 px-4 py-2 rounded"
      >
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


{/* STEP 3 – Order by Program Quality */}
{currentStep === 3 && (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Step 3 – Order by Program Quality</h2>
    <p className="text-gray-600">
      Based on Doximity, fellowship placements, reputation, etc., reorder each list below so that your #1 here is the highest‐quality program. Use outside sources as you like.
    </p>

    <div className="grid grid-cols-2 gap-8">
      {/* Applicant 1 Quality Order */}
      <div>
        <h3 className="font-semibold">Applicant 1 – Quality Order</h3>
        <DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={evt => handleDragEndQuality(evt, 1)}
>
  <SortableContext
    items={applicant1QualityOrder.map(p => p.id)}
    strategy={verticalListSortingStrategy}
  >
    {applicant1QualityOrder.map((p, idx) => (
      <SortableItem
        key={p.id}
        id={p.id}
        onDelete={() =>
          setApplicant1QualityOrder(q => q.filter(x => x.id !== p.id))
        }
      >
        {`${idx + 1}. ${p.name}`}
      </SortableItem>
    ))}
  </SortableContext>
</DndContext>


      </div>

      {/* Applicant 2 Quality Order */}
      <div>
        <h3 className="font-semibold">Applicant 2 – Quality Order</h3>
        <DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={evt => handleDragEndQuality(evt, 2)}
>
  <SortableContext
    items={applicant2QualityOrder.map(p => p.id)}
    strategy={verticalListSortingStrategy}
  >
    {applicant2QualityOrder.map((p, idx) => (
      <SortableItem
        key={p.id}
        id={p.id}
        onDelete={() =>
          setApplicant2QualityOrder(q => q.filter(x => x.id !== p.id))
        }
      >
        {`${idx + 1}. ${p.name}`}
      </SortableItem>
    ))}
  </SortableContext>
</DndContext>



      </div>
    </div>

    <div className="mt-6 flex justify-between">
      <button
        onClick={() => setCurrentStep(2)}
        className="bg-gray-300 px-4 py-2 rounded"
      >
        ← Back
      </button>
      <button
        onClick={() => setCurrentStep(4)}
        disabled={
          applicant1QualityOrder.length !== applicant1Programs.length ||
          applicant2QualityOrder.length !== applicant2Programs.length
        }
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Next: Rate Cities →
      </button>
    </div>
  </div>
)}


        {/* STEP 4 – Enter Lifestyle Fit Scores */}
        {currentStep === 4 && (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Step 4 – Rate Each City (1–10)</h2>
    <p className="text-gray-600">
      You and your partner decide together: how much do you like living in each city on a scale of 1 (low) to 10 (high)?
    </p>

    <div className="space-y-2">
      {allCities.map(cityState => (
        <div key={cityState} className="flex items-center gap-4">
          <span className="flex-1">{cityState}</span>
          <input
            type="number"
            min={1}
            max={10}
            value={cityRatings[cityState] ?? ''}
            onChange={e => {
              const v = Math.max(1, Math.min(10, +e.target.value));
              setCityRatings(prev => ({ ...prev, [cityState]: v }));
            }}
            className="w-16 border p-1 rounded"
          />
        </div>
      ))}
    </div>

    <div className="mt-6 flex justify-between">
      <button onClick={() => setCurrentStep(3)} className="bg-gray-300 px-4 py-2 rounded">
        ← Back
      </button>
      <button
        onClick={() => setCurrentStep(5)}
        disabled={allCities.some(city => typeof cityRatings[city] !== 'number')}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Next: Adjust Weights →
      </button>
    </div>
  </div>
)}

{/* STEP 5 – Adjust Weights */}
{currentStep === 5 && (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold">Step 5 – Adjust Weights</h2>
    <p className="text-gray-600">
      Use these sliders to decide how much each factor counts toward your final combined list.
      The total must stay at or below 100%.
    </p>

    {/* MAKE THIS A VERTICAL STACK */}
    <div className="flex flex-col space-y-8">
      {Object.entries(weights).map(([key, val]) => (
        <div key={key} className="border rounded-lg p-4 text-left">
          {/* Title & description on same line */}
          <div className="mb-2">
            <span className="font-semibold">{labels[key].title}</span>:{' '}
            <span className="text-sm text-gray-500">{labels[key].desc}</span>
          </div>

          {/* Slider + percentage side by side */}
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={val}
              onChange={e => handleWeightChange(key, e.target.value)}
              className="flex-1"
            />
            <span className="w-12 text-right font-mono">{val}%</span>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-6 flex justify-between">
      <button
        onClick={() => setCurrentStep(4)}
        className="bg-gray-300 px-4 py-2 rounded"
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