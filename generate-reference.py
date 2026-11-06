"""Independent NumPy reference, never required by the offline website or its build.

SOAP is integrated directly over radial / cos(theta) / phi quadrature, without
the engine's Bessel angular projection. Radial orthonormality uses the exact
polynomial Gram matrix + Cholesky, not engine Gram-Schmidt quadrature.
"""
import json
import math
from pathlib import Path
import numpy as np

OUT = Path(__file__).with_name('fixtures')
OUT.mkdir(exist_ok=True)
xyz = np.array([[0.,0.,0.],[1.15,.2,.15],[-.55,1.1,.3],[-.7,-.55,.95],[.25,-.6,-1.15]])
elements = ['C','H','H','O','H']
species = ['H','C','O']
rc, sigma, radial, lmax = 3., .35, 3, 2
fc = lambda d: np.where(d < rc, .5*(np.cos(np.pi*d/rc)+1), 0.)

def sh(u):
    x,y,z=np.asarray(u).T
    return np.array([np.ones_like(x)/np.sqrt(4*np.pi),
        np.sqrt(3/(4*np.pi))*y,np.sqrt(3/(4*np.pi))*z,np.sqrt(3/(4*np.pi))*x,
        np.sqrt(15/(4*np.pi))*x*y,np.sqrt(15/(4*np.pi))*y*z,
        np.sqrt(5/(16*np.pi))*(3*z*z-1),np.sqrt(15/(4*np.pi))*x*z,
        np.sqrt(15/(16*np.pi))*(x*x-y*y)]).T

def soap_direct(nr=128, nt=64, np_=128):
    xr,wr=np.polynomial.legendre.leggauss(nr)
    r=(xr+1)*rc/2
    wr=wr*rc/2*r*r
    mu,wm=np.polynomial.legendre.leggauss(nt)
    phi=np.arange(np_)*2*np.pi/np_
    mu,phi=np.meshgrid(mu,phi,indexing='ij')
    u=np.stack([np.sqrt(1-mu*mu)*np.cos(phi),np.sqrt(1-mu*mu)*np.sin(phi),mu],axis=-1).reshape(-1,3)
    wa=np.repeat(wm,np_)*2*np.pi/np_
    Y=sh(u)
    gram=np.array([[2*rc**3/((i+j+7)*(i+j+8)*(i+j+9)) for j in range(radial)] for i in range(radial)])
    coeff=np.linalg.inv(np.linalg.cholesky(gram))
    g=np.stack([(1-r/rc)**(n+3) for n in range(radial)],axis=-1)@coeff.T
    out={}
    for sp in species:
        rho=np.zeros((nr,len(u)))
        for j in range(1,len(xyz)):
            if elements[j]!=sp: continue
            d=np.linalg.norm(xyz[j])
            distances=r[:,None]**2+d*d-2*r[:,None]*(u@xyz[j])[None,:]
            rho += fc(d)*np.exp(-distances/(2*sigma*sigma))
        c=(g*wr[:,None]).T@(rho@(Y*wa[:,None]))
        for n in range(radial):
            for l in range(lmax+1): out[(sp,n,l)]=c[n,l*l:(l+1)**2]
    coefficients=[dict(species=sp,n=n,l=l,m=m,value=float(out[(sp,n,l)][m+l]))
        for sp in species for n in range(radial) for l in range(lmax+1) for m in range(-l,l+1)]
    power=[float(np.pi*np.sqrt(8/(2*l+1))*(out[(a,n,l)]@out[(b,nn,l)]))
        for a in species for b in species for n in range(radial) for nn in range(radial) for l in range(lmax+1)]
    return coefficients,power

def acsf_direct():
    d=np.linalg.norm(xyz[1:],axis=1)
    vals=[]
    for sp in species:
        for n in range(radial):
            rs=1+(n-(radial-1)/2)*.45
            vals.append(sum(float(np.exp(-(d[j-1]-rs)**2)*fc(d[j-1])) for j in range(1,len(xyz)) if elements[j]==sp))
    for ia,a in enumerate(species):
        for b in species[ia:]:
            total=0.
            for j in range(1,len(xyz)):
                for k in range(1,len(xyz)):
                    if j==k:continue
                    if sorted([elements[j],elements[k]]) != sorted([a,b]):continue
                    dj,dk=d[j-1],d[k-1];djk=np.linalg.norm(xyz[j]-xyz[k]);c=xyz[j]@xyz[k]/(dj*dk)
                    total += .5*(1+c)**2*np.exp(-(dj*dj+dk*dk+djk*djk))*fc(dj)*fc(dk)*fc(djk)
            vals.append(float(total))
    return vals

def energy(x):
    result=0.
    for i in range(len(x)):
        for j in range(i+1,len(x)):
            d=np.linalg.norm(x[j]-x[i]);result+=.3*fc(d)*(d-1.2)**2
    for i in range(len(x)):
        for j in range(len(x)):
            if j==i:continue
            for k in range(j+1,len(x)):
                if k==i:continue
                a,b=x[j]-x[i],x[k]-x[i];r,s=np.linalg.norm(a),np.linalg.norm(b)
                result+=.12*fc(r)*fc(s)*(a@b/(r*s)+1/3)**2
    return float(result)

c,p=soap_direct()
# A second independent quadrature resolution confirms fixture integration.
c2,p2=soap_direct(160,80,160)
delta=max(abs(a-b) for a,b in zip(p,p2))
assert delta<1e-9, delta
h=1e-5
forces=np.zeros_like(xyz)
for i in range(len(xyz)):
    for k in range(3):
        a,b=xyz.copy(),xyz.copy();a[i,k]+=h;b[i,k]-=h
        forces[i,k]=-(energy(a)-energy(b))/(2*h)
u=np.array([.2,.3,.5]);u=u/np.linalg.norm(u)
v=np.array([-.1,.7,.4]);v=v/np.linalg.norm(v)
fixture={
    'source':'Independent NumPy direct 3D Gaussian quadrature + analytic Gram/Cholesky; see generate-reference.py',
    'convergenceMaxPowerDifference':delta,
    'atoms':[dict(id=i,element=elements[i],pos=list(x)) for i,x in enumerate(xyz)],
    'params':dict(cutoff=rc,sigma=sigma,radial=radial,lmax=lmax),
    'acsf':acsf_direct(),'soapCoefficients':c2,'soapPower':p2,
    'harmonicDirection':list(u),'harmonics':list(sh(u)),
    'tensor':dict(u=list(u),v=list(v),scalar=float(u@v),axial=list(np.cross(u,v)),symmetric=((np.outer(u,v)+np.outer(v,u))/2-np.eye(3)*(u@v)/3).tolist()),
    'energy':energy(xyz),'forces':forces.tolist()
}
(OUT/'reference.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'fixture':'fixtures/reference.json','quadratureConvergence':delta,'coefficients':len(c2),'powerTerms':len(p2)}))
