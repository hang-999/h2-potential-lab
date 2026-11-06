# Numerical API (v4)

`MLIP.compute(state)` validates and returns a JSON-compatible immutable-by-convention snapshot. All arrays contain ordinary JS numbers. Coordinates are Å; teaching readouts are dimensionless unless explicitly marked eV. Defaults and presets are cloned before editing.

```
{
 version, atoms, center, params,
 geometry:{neighbors:[{index,id,element,r,unit:[3],cutoff}],angles:[{j,k,theta,cos}],edges:[{from,to,r,cutoff}],minDistance},
 acsf:{features:[{label,kind:'radial'|'angular',value,terms:[{indices:[...],value}]}],radial:[number],angular:[number],readout:{hidden:[number],contributions:[number],value}},
 soap:{coefficients:[{species,n,l,m,value}],power:[{label,speciesA,speciesB,n,n2,l,value}],norm,kernel,referencePower:[number],density:[{r,value}],radialBasis:[{r,values:[number]}],convention},
 moments:{s,v:[3],Q:[[3],[3],[3]],invariants:[{label,value}],terms:[{indices:[...],value}],readout},
 messages:{layers:[{round,nodes:[{index,s:[number],v:[[3],...]}],edges:[{from,to,r,filter:[number],message:[number],vectorMessage:[[3],...]}]}],readout:[number],total},
 vectors:{layers:[same as messages],vector:[3],scalar,readout:[number],total},
 harmonics:{direction:[3],groups:[{l,values:[number]}]},
 tensor:{u:[3],v:[3],scalar,axial:[3],symmetric:[[3],[3],[3]],reconstructionError},
 mace:{order,features:[{label,value}],terms:[{indices:[...],value}],readout},
 energy:{value,forces:[[3],...],units:'eV',formula},
 diagnostics:{rotation:{acsf,soap,moments,momentReadout,messageScalar,scalar,vector,tensor,tensorProduct,harmonics,maceReadout,energy,forces},translation:{acsf,soap,energy},permutation:{acsf,soap,energy},reflection:{scalar,vector,tensor,axial,energy,forces}},
 transformed:{atoms,vector:[3],expectedVector:[3],Q:[[3],[3],[3]],expectedQ:[[3],[3],[3]],energy,forces:[[3],...],vectorLayers:[same as vectors.layers],messageLayers:[same as messages.layers],harmonics:{direction,groups},expectedHarmonics:[{l,values}],tensor:{same as tensor},expectedTensor:[[3],[3],[3]]}, warnings:[string]
}
```

`soap.kernel` compares current environment with `state.referenceAtoms` / `referenceCenter` when supplied, otherwise the fixed tetrahedral reference, using the same species/radial basis settings, normalized dot product raised to 2. `soap.referenceAtoms` and `referenceCenter` identify the actual comparison environment. This is a finite-basis Gaussian neighbor-density projection with radial quadrature, not a full GAP predictor. A full species cross-power tensor is retained (including symmetric pairs), avoiding hidden multiplicity weights in the normalized kernel. Power convention is `π sqrt(8/(2l+1)) sum_m c_A c_B`.

`MLIP.presets` keys environment/water/tetrahedron/chain; values arrays of `{id,element,pos}`. `MLIP.defaults` is params. `MLIP.validate(state)` returns a normalized deep clone or throws Error with `.field`. `MLIP.transformAtoms(atoms, transform)` supports axis x/y/z, angle in degrees and reflection across x. `MLIP.math` exposes vector/matrix helpers and realSH. Individual exported functions geometry/acsf/soap/moments/messagePassing/harmonics/tensorProduct/correlations/energyForces allow independent numerical tests. `compute` returns all chapters for one configuration; `stage` is deliberately ignored by numerical computation.

`acsf.readout.model` exposes `{seed:42,inputWeights,biases,outputWeights}` for the selected element's actual four-unit toy MLP. `messages.model` and `vectors.model` expose `{seed:42,embedding,filterCoefficients,readoutCoefficients,weights}`. All fixed initialized coefficients use Mulberry32(42); the four editable multipliers are not training results.

Use `diagnostics.rotation.messageScalar` for the scalar-only message model (the existing `scalar` is the vector model's invariant readout). `tensorProduct` checks the displayed tensor product, while `tensor` checks the moment Q. `harmonics` compares complete direct-evaluated `Y(Ru)` groups against `D(R)Y(u)` computed through a Cartesian representation using `math.rotateSH`; it is not only a norm check. `transformed.vectorLayers` is provided for selected-node/current-round visualization, avoiding mixing a current-stage left panel with a final-stage right panel.
