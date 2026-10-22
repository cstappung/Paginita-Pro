var pm=Object.defineProperty;var ki=(i,e,t)=>()=>{if(t)throw t[0];try{return i&&(e=i(i=0)),e}catch(n){throw t=[n],n}};var fm=(i,e)=>{for(var t in e)pm(i,t,{get:e[t],enumerable:!0})};function Sn(){let i=4294967295*Math.random()|0,e=4294967295*Math.random()|0,t=4294967295*Math.random()|0,n=4294967295*Math.random()|0;return(Ti[255&i]+Ti[i>>8&255]+Ti[i>>16&255]+Ti[i>>24&255]+"-"+Ti[255&e]+Ti[e>>8&255]+"-"+Ti[e>>16&15|64]+Ti[e>>24&255]+"-"+Ti[63&t|128]+Ti[t>>8&255]+"-"+Ti[t>>16&255]+Ti[t>>24&255]+Ti[255&n]+Ti[n>>8&255]+Ti[n>>16&255]+Ti[n>>24&255]).toLowerCase()}function ui(i,e,t){return Math.max(e,Math.min(t,i))}function m0(i,e){return(i%e+e)%e}function ks(i,e,t){return(1-t)*i+t*e}function g0(i){return(i&i-1)==0&&i!==0}function dl(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Dn(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function It(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(4294967295*i);case Uint16Array:return Math.round(65535*i);case Uint8Array:return Math.round(255*i);case Int32Array:return Math.round(2147483647*i);case Int16Array:return Math.round(32767*i);case Int8Array:return Math.round(127*i);default:throw new Error("Invalid component type.")}}function mp(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function pl(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function bm(){let i=pl("canvas");return i.style.display="block",i}function Ns(i){i in qu||(qu[i]=!0,console.warn(i))}function Va(i){return i<.04045?.0773993808*i:Math.pow(.9478672986*i+.0521327014,2.4)}function Pc(i){return i<.0031308?12.92*i:1.055*Math.pow(i,.41666)-.055}function Lc(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?fl.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}function Dc(i,e,t,n,r){for(let a=0,s=i.length-3;a<=s;a+=3){Nr.fromArray(i,a);let o=r.x*Math.abs(Nr.x)+r.y*Math.abs(Nr.y)+r.z*Math.abs(Nr.z),l=e.dot(Nr),c=t.dot(Nr),h=n.dot(Nr);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}function Gc(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+6*(e-i)*t:t<.5?e:t<2/3?i+6*(e-i)*(2/3-t):i}function Dm(){let i=new ArrayBuffer(4),e=new Float32Array(i),t=new Uint32Array(i),n=new Uint32Array(512),r=new Uint32Array(512);for(let l=0;l<256;++l){let c=l-127;c<-27?(n[l]=0,n[256|l]=32768,r[l]=24,r[256|l]=24):c<-14?(n[l]=1024>>-c-14,n[256|l]=1024>>-c-14|32768,r[l]=-c-1,r[256|l]=-c-1):c<=15?(n[l]=c+15<<10,n[256|l]=c+15<<10|32768,r[l]=13,r[256|l]=13):c<128?(n[l]=31744,n[256|l]=64512,r[l]=24,r[256|l]=24):(n[l]=31744,n[256|l]=64512,r[l]=13,r[256|l]=13)}let a=new Uint32Array(2048),s=new Uint32Array(64),o=new Uint32Array(64);for(let l=1;l<1024;++l){let c=l<<13,h=0;for(;(8388608&c)==0;)c<<=1,h-=8388608;c&=-8388609,h+=947912704,a[l]=c|h}for(let l=1024;l<2048;++l)a[l]=939524096+(l-1024<<13);for(let l=1;l<31;++l)s[l]=l<<23;s[31]=1199570944,s[32]=2147483648;for(let l=33;l<63;++l)s[l]=2147483648+(l-32<<23);s[63]=3347054592;for(let l=1;l<64;++l)l!==32&&(o[l]=1024);return{floatView:e,uint32View:t,baseTable:n,shiftTable:r,mantissaTable:a,exponentTable:s,offsetTable:o}}function Ho(i,e,t,n,r,a,s,o,l,c){i.getVertexPosition(o,Pa),i.getVertexPosition(l,La),i.getVertexPosition(c,Ia);let h=(function(d,u,p,m,g,f,y,x){let v;if(v=u.side===di?m.intersectTriangle(y,f,g,!0,x):m.intersectTriangle(g,f,y,u.side===ni,x),v===null)return null;zo.copy(x),zo.applyMatrix4(d.matrixWorld);let E=p.ray.origin.distanceTo(zo);return E<p.near||E>p.far?null:{distance:E,point:zo.clone(),object:d}})(i,e,t,n,Pa,La,Ia,Oo);if(h){r&&(ko.fromBufferAttribute(r,o),No.fromBufferAttribute(r,l),Bo.fromBufferAttribute(r,c),h.uv=dr.getInterpolation(Oo,Pa,La,Ia,ko,No,Bo,new Re)),a&&(ko.fromBufferAttribute(a,o),No.fromBufferAttribute(a,l),Bo.fromBufferAttribute(a,c),h.uv1=dr.getInterpolation(Oo,Pa,La,Ia,ko,No,Bo,new Re),h.uv2=h.uv1),s&&(sd.fromBufferAttribute(s,o),od.fromBufferAttribute(s,l),ld.fromBufferAttribute(s,c),h.normal=dr.getInterpolation(Oo,Pa,La,Ia,sd,od,ld,new D),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:l,c,normal:new D,materialIndex:0};dr.getNormal(Pa,La,Ia,d.normal),h.face=d}return h}function Qa(i){let e={};for(let t in i){e[t]={};for(let n in i[t]){let r=i[t][n];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=r.clone():Array.isArray(r)?e[t][n]=r.slice():e[t][n]=r}}return e}function Pi(i){let e={};for(let t=0;t<i.length;t++){let n=Qa(i[t]);for(let r in n)e[r]=n[r]}return e}function vp(i){return i.getRenderTarget()===null?i.outputColorSpace:Rt.workingColorSpace}function xp(){let i=null,e=!1,t=null,n=null;function r(a,s){t(a,s),n=i.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(r),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(a){t=a},setContext:function(a){i=a}}}function Bm(i,e){let t=e.isWebGL2,n=new WeakMap;return{get:function(r){return r.isInterleavedBufferAttribute&&(r=r.data),n.get(r)},remove:function(r){r.isInterleavedBufferAttribute&&(r=r.data);let a=n.get(r);a&&(i.deleteBuffer(a.buffer),n.delete(r))},update:function(r,a){if(r.isGLBufferAttribute){let o=n.get(r);return void((!o||o.version<r.version)&&n.set(r,{buffer:r.buffer,type:r.type,bytesPerElement:r.elementSize,version:r.version}))}r.isInterleavedBufferAttribute&&(r=r.data);let s=n.get(r);if(s===void 0)n.set(r,(function(o,l){let c=o.array,h=o.usage,d=c.byteLength,u=i.createBuffer(),p;if(i.bindBuffer(l,u),i.bufferData(l,c,h),o.onUploadCallback(),c instanceof Float32Array)p=i.FLOAT;else if(c instanceof Uint16Array)if(o.isFloat16BufferAttribute){if(!t)throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");p=i.HALF_FLOAT}else p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else{if(!(c instanceof Uint8ClampedArray))throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);p=i.UNSIGNED_BYTE}return{buffer:u,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:d}})(r,a));else if(s.version<r.version){if(s.size!==r.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");(function(o,l,c){let h=l.array,d=l._updateRange,u=l.updateRanges;if(i.bindBuffer(c,o),d.count===-1&&u.length===0&&i.bufferSubData(c,0,h),u.length!==0){for(let p=0,m=u.length;p<m;p++){let g=u[p];t?i.bufferSubData(c,g.start*h.BYTES_PER_ELEMENT,h,g.start,g.count):i.bufferSubData(c,g.start*h.BYTES_PER_ELEMENT,h.subarray(g.start,g.start+g.count))}l.clearUpdateRanges()}d.count!==-1&&(t?i.bufferSubData(c,d.offset*h.BYTES_PER_ELEMENT,h,d.offset,d.count):i.bufferSubData(c,d.offset*h.BYTES_PER_ELEMENT,h.subarray(d.offset,d.offset+d.count)),d.count=-1),l.onUploadCallback()})(s.buffer,r,a),s.version=r.version}}}}function Om(i,e,t,n,r,a,s){let o=new ke(0),l,c,h=a===!0?0:1,d=null,u=0,p=null;function m(g,f){g.getRGB(Go,vp(i)),n.buffers.color.setClear(Go.r,Go.g,Go.b,f,s)}return{getClearColor:function(){return o},setClearColor:function(g,f=1){o.set(g),h=f,m(o,h)},getClearAlpha:function(){return h},setClearAlpha:function(g){h=g,m(o,h)},render:function(g,f){let y=!1,x=f.isScene===!0?f.background:null;x&&x.isTexture&&(x=(f.backgroundBlurriness>0?t:e).get(x)),x===null?m(o,h):x&&x.isColor&&(m(x,1),y=!0);let v=i.xr.getEnvironmentBlendMode();v==="additive"?n.buffers.color.setClear(0,0,0,1,s):v==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,s),(i.autoClear||y)&&i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil),x&&(x.isCubeTexture||x.mapping===kl)?(c===void 0&&(c=new yt(new Xe(1,1,1),new qt({name:"BackgroundCubeMaterial",uniforms:Qa(Ln.backgroundCube.uniforms),vertexShader:Ln.backgroundCube.vertexShader,fragmentShader:Ln.backgroundCube.fragmentShader,side:di,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(E,S,T){this.matrixWorld.copyPosition(T.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(c)),c.material.uniforms.envMap.value=x,c.material.uniforms.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,c.material.uniforms.backgroundBlurriness.value=f.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,c.material.toneMapped=Rt.getTransfer(x.colorSpace)!==Ut,d===x&&u===x.version&&p===i.toneMapping||(c.material.needsUpdate=!0,d=x,u=x.version,p=i.toneMapping),c.layers.enableAll(),g.unshift(c,c.geometry,c.material,0,0,null)):x&&x.isTexture&&(l===void 0&&(l=new yt(new pi(2,2),new qt({name:"BackgroundMaterial",uniforms:Qa(Ln.background.uniforms),vertexShader:Ln.background.vertexShader,fragmentShader:Ln.background.fragmentShader,side:ni,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(l)),l.material.uniforms.t2D.value=x,l.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,l.material.toneMapped=Rt.getTransfer(x.colorSpace)!==Ut,x.matrixAutoUpdate===!0&&x.updateMatrix(),l.material.uniforms.uvTransform.value.copy(x.matrix),d===x&&u===x.version&&p===i.toneMapping||(l.material.needsUpdate=!0,d=x,u=x.version,p=i.toneMapping),l.layers.enableAll(),g.unshift(l,l.geometry,l.material,0,0,null))}}}function zm(i,e,t,n){let r=i.getParameter(i.MAX_VERTEX_ATTRIBS),a=n.isWebGL2?null:e.get("OES_vertex_array_object"),s=n.isWebGL2||a!==null,o={},l=p(null),c=l,h=!1;function d(S){return n.isWebGL2?i.bindVertexArray(S):a.bindVertexArrayOES(S)}function u(S){return n.isWebGL2?i.deleteVertexArray(S):a.deleteVertexArrayOES(S)}function p(S){let T=[],C=[],L=[];for(let I=0;I<r;I++)T[I]=0,C[I]=0,L[I]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:T,enabledAttributes:C,attributeDivisors:L,object:S,attributes:{},index:null}}function m(){let S=c.newAttributes;for(let T=0,C=S.length;T<C;T++)S[T]=0}function g(S){f(S,0)}function f(S,T){let C=c.newAttributes,L=c.enabledAttributes,I=c.attributeDivisors;C[S]=1,L[S]===0&&(i.enableVertexAttribArray(S),L[S]=1),I[S]!==T&&((n.isWebGL2?i:e.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](S,T),I[S]=T)}function y(){let S=c.newAttributes,T=c.enabledAttributes;for(let C=0,L=T.length;C<L;C++)T[C]!==S[C]&&(i.disableVertexAttribArray(C),T[C]=0)}function x(S,T,C,L,I,V,X){X===!0?i.vertexAttribIPointer(S,T,C,I,V):i.vertexAttribPointer(S,T,C,L,I,V)}function v(){E(),h=!0,c!==l&&(c=l,d(c.object))}function E(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:function(S,T,C,L,I){let V=!1;if(s){let X=(function(N,oe,F){let ne=F.wireframe===!0,$=o[N.id];$===void 0&&($={},o[N.id]=$);let O=$[oe.id];O===void 0&&(O={},$[oe.id]=O);let q=O[ne];return q===void 0&&(q=p(n.isWebGL2?i.createVertexArray():a.createVertexArrayOES()),O[ne]=q),q})(L,C,T);c!==X&&(c=X,d(c.object)),V=(function(N,oe,F,ne){let $=c.attributes,O=oe.attributes,q=0,se=F.getAttributes();for(let Z in se)if(se[Z].location>=0){let te=$[Z],Ce=O[Z];if(Ce===void 0&&(Z==="instanceMatrix"&&N.instanceMatrix&&(Ce=N.instanceMatrix),Z==="instanceColor"&&N.instanceColor&&(Ce=N.instanceColor)),te===void 0||te.attribute!==Ce||Ce&&te.data!==Ce.data)return!0;q++}return c.attributesNum!==q||c.index!==ne})(S,L,C,I),V&&(function(N,oe,F,ne){let $={},O=oe.attributes,q=0,se=F.getAttributes();for(let Z in se)if(se[Z].location>=0){let te=O[Z];te===void 0&&(Z==="instanceMatrix"&&N.instanceMatrix&&(te=N.instanceMatrix),Z==="instanceColor"&&N.instanceColor&&(te=N.instanceColor));let Ce={};Ce.attribute=te,te&&te.data&&(Ce.data=te.data),$[Z]=Ce,q++}c.attributes=$,c.attributesNum=q,c.index=ne})(S,L,C,I)}else{let X=T.wireframe===!0;c.geometry===L.id&&c.program===C.id&&c.wireframe===X||(c.geometry=L.id,c.program=C.id,c.wireframe=X,V=!0)}I!==null&&t.update(I,i.ELEMENT_ARRAY_BUFFER),(V||h)&&(h=!1,(function(X,N,oe,F){if(n.isWebGL2===!1&&(X.isInstancedMesh||F.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;m();let ne=F.attributes,$=oe.getAttributes(),O=N.defaultAttributeValues;for(let q in $){let se=$[q];if(se.location>=0){let Z=ne[q];if(Z===void 0&&(q==="instanceMatrix"&&X.instanceMatrix&&(Z=X.instanceMatrix),q==="instanceColor"&&X.instanceColor&&(Z=X.instanceColor)),Z!==void 0){let te=Z.normalized,Ce=Z.itemSize,R=t.get(Z);if(R===void 0)continue;let w=R.buffer,K=R.type,W=R.bytesPerElement,U=n.isWebGL2===!0&&(K===i.INT||K===i.UNSIGNED_INT||Z.gpuType===op);if(Z.isInterleavedBufferAttribute){let re=Z.data,k=re.stride,H=Z.offset;if(re.isInstancedInterleavedBuffer){for(let ie=0;ie<se.locationSize;ie++)f(se.location+ie,re.meshPerAttribute);X.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=re.meshPerAttribute*re.count)}else for(let ie=0;ie<se.locationSize;ie++)g(se.location+ie);i.bindBuffer(i.ARRAY_BUFFER,w);for(let ie=0;ie<se.locationSize;ie++)x(se.location+ie,Ce/se.locationSize,K,te,k*W,(H+Ce/se.locationSize*ie)*W,U)}else{if(Z.isInstancedBufferAttribute){for(let re=0;re<se.locationSize;re++)f(se.location+re,Z.meshPerAttribute);X.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=Z.meshPerAttribute*Z.count)}else for(let re=0;re<se.locationSize;re++)g(se.location+re);i.bindBuffer(i.ARRAY_BUFFER,w);for(let re=0;re<se.locationSize;re++)x(se.location+re,Ce/se.locationSize,K,te,Ce*W,Ce/se.locationSize*re*W,U)}}else if(O!==void 0){let te=O[q];if(te!==void 0)switch(te.length){case 2:i.vertexAttrib2fv(se.location,te);break;case 3:i.vertexAttrib3fv(se.location,te);break;case 4:i.vertexAttrib4fv(se.location,te);break;default:i.vertexAttrib1fv(se.location,te)}}}}y()})(S,T,C,L),I!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(I).buffer))},reset:v,resetDefaultState:E,dispose:function(){v();for(let S in o){let T=o[S];for(let C in T){let L=T[C];for(let I in L)u(L[I].object),delete L[I];delete T[C]}delete o[S]}},releaseStatesOfGeometry:function(S){if(o[S.id]===void 0)return;let T=o[S.id];for(let C in T){let L=T[C];for(let I in L)u(L[I].object),delete L[I];delete T[C]}delete o[S.id]},releaseStatesOfProgram:function(S){for(let T in o){let C=o[T];if(C[S.id]===void 0)continue;let L=C[S.id];for(let I in L)u(L[I].object),delete L[I];delete C[S.id]}},initAttributes:m,enableAttribute:g,disableUnusedAttributes:y}}function Hm(i,e,t,n){let r=n.isWebGL2,a;this.setMode=function(s){a=s},this.render=function(s,o){i.drawArrays(a,s,o),t.update(o,a,1)},this.renderInstances=function(s,o,l){if(l===0)return;let c,h;if(r)c=i,h="drawArraysInstanced";else if(c=e.get("ANGLE_instanced_arrays"),h="drawArraysInstancedANGLE",c===null)return void console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");c[h](a,s,o,l),t.update(o,a,l)},this.renderMultiDraw=function(s,o,l){if(l===0)return;let c=e.get("WEBGL_multi_draw");if(c===null)for(let h=0;h<l;h++)this.render(s[h],o[h]);else{c.multiDrawArraysWEBGL(a,s,0,o,0,l);let h=0;for(let d=0;d<l;d++)h+=o[d];t.update(h,a,1)}}}function Fm(i,e,t){let n;function r(E){if(E==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";E="mediump"}return E==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let a=typeof WebGL2RenderingContext<"u"&&i.constructor.name==="WebGL2RenderingContext",s=t.precision!==void 0?t.precision:"highp",o=r(s);o!==s&&(console.warn("THREE.WebGLRenderer:",s,"not supported, using",o,"instead."),s=o);let l=a||e.has("WEBGL_draw_buffers"),c=t.logarithmicDepthBuffer===!0,h=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),d=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),u=i.getParameter(i.MAX_TEXTURE_SIZE),p=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),m=i.getParameter(i.MAX_VERTEX_ATTRIBS),g=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),f=i.getParameter(i.MAX_VARYING_VECTORS),y=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),x=d>0,v=a||e.has("OES_texture_float");return{isWebGL2:a,drawBuffers:l,getMaxAnisotropy:function(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){let E=e.get("EXT_texture_filter_anisotropic");n=i.getParameter(E.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n},getMaxPrecision:r,precision:s,logarithmicDepthBuffer:c,maxTextures:h,maxVertexTextures:d,maxTextureSize:u,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:g,maxVaryings:f,maxFragmentUniforms:y,vertexTextures:x,floatFragmentTextures:v,floatVertexTextures:x&&v,maxSamples:a?i.getParameter(i.MAX_SAMPLES):0}}function Gm(i){let e=this,t=null,n=0,r=!1,a=!1,s=new er,o=new dt,l={value:null,needsUpdate:!1};function c(h,d,u,p){let m=h!==null?h.length:0,g=null;if(m!==0){if(g=l.value,p!==!0||g===null){let f=u+4*m,y=d.matrixWorldInverse;o.getNormalMatrix(y),(g===null||g.length<f)&&(g=new Float32Array(f));for(let x=0,v=u;x!==m;++x,v+=4)s.copy(h[x]).applyMatrix4(y,o),s.normal.toArray(g,v),g[v+3]=s.constant}l.value=g,l.needsUpdate=!0}return e.numPlanes=m,e.numIntersection=0,g}this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d){let u=h.length!==0||d||n!==0||r;return r=d,n=h.length,u},this.beginShadows=function(){a=!0,c(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(h,d){t=c(h,d,0)},this.setState=function(h,d,u){let p=h.clippingPlanes,m=h.clipIntersection,g=h.clipShadows,f=i.get(h);if(!r||p===null||p.length===0||a&&!g)a?c(null):(function(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0})();else{let y=a?0:n,x=4*y,v=f.clippingState||null;l.value=v,v=c(p,d,x,u);for(let E=0;E!==x;++E)v[E]=t[E];f.clippingState=v,this.numIntersection=m?this.numPlanes:0,this.numPlanes+=y}}}function Vm(i){let e=new WeakMap;function t(r,a){return a===h0?r.mapping=ja:a===u0&&(r.mapping=Xa),r}function n(r){let a=r.target;a.removeEventListener("dispose",n);let s=e.get(a);s!==void 0&&(e.delete(a),s.dispose())}return{get:function(r){if(r&&r.isTexture){let a=r.mapping;if(a===h0||a===u0){if(e.has(r))return t(e.get(r).texture,r.mapping);{let s=r.image;if(s&&s.height>0){let o=new b0(s.height/2);return o.fromEquirectangularTexture(i,r),e.set(r,o),r.addEventListener("dispose",n),t(o.texture,r.mapping)}return null}}}return r},dispose:function(){e=new WeakMap}}}function dd(i,e,t){let n=new _i(i,e,t);return n.texture.mapping=kl,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Vo(i,e,t,n,r){i.viewport.set(e,t,n,r),i.scissor.set(e,t,n,r)}function pd(){return new qt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ph(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function fd(){return new qt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ph(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function ph(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Wm(i){let e=new WeakMap,t=null;function n(r){let a=r.target;a.removeEventListener("dispose",n);let s=e.get(a);s!==void 0&&(e.delete(a),s.dispose())}return{get:function(r){if(r&&r.isTexture){let a=r.mapping,s=a===h0||a===u0,o=a===ja||a===Xa;if(s||o){if(r.isRenderTargetTexture&&r.needsPMREMUpdate===!0){r.needsPMREMUpdate=!1;let l=e.get(r);return t===null&&(t=new bl(i)),l=s?t.fromEquirectangular(r,l):t.fromCubemap(r,l),e.set(r,l),l.texture}if(e.has(r))return e.get(r).texture;{let l=r.image;if(s&&l&&l.height>0||o&&l&&(function(c){let h=0,d=6;for(let u=0;u<d;u++)c[u]!==void 0&&h++;return h===d})(l)){t===null&&(t=new bl(i));let c=s?t.fromEquirectangular(r):t.fromCubemap(r);return e.set(r,c),r.addEventListener("dispose",n),c.texture}return null}}}return r},dispose:function(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}}}function jm(i){let e={};function t(n){if(e[n]!==void 0)return e[n];let r;switch(n){case"WEBGL_depth_texture":r=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=i.getExtension(n)}return e[n]=r,r}return{has:function(n){return t(n)!==null},init:function(n){n.isWebGL2?(t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance")):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture")},get:function(n){let r=t(n);return r===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),r}}}function Xm(i,e,t,n){let r={},a=new WeakMap;function s(l){let c=l.target;c.index!==null&&e.remove(c.index);for(let d in c.attributes)e.remove(c.attributes[d]);for(let d in c.morphAttributes){let u=c.morphAttributes[d];for(let p=0,m=u.length;p<m;p++)e.remove(u[p])}c.removeEventListener("dispose",s),delete r[c.id];let h=a.get(c);h&&(e.remove(h),a.delete(c)),n.releaseStatesOfGeometry(c),c.isInstancedBufferGeometry===!0&&delete c._maxInstanceCount,t.memory.geometries--}function o(l){let c=[],h=l.index,d=l.attributes.position,u=0;if(h!==null){let g=h.array;u=h.version;for(let f=0,y=g.length;f<y;f+=3){let x=g[f+0],v=g[f+1],E=g[f+2];c.push(x,v,v,E,E,x)}}else{if(d===void 0)return;{let g=d.array;u=d.version;for(let f=0,y=g.length/3-1;f<y;f+=3){let x=f+0,v=f+1,E=f+2;c.push(x,v,v,E,E,x)}}}let p=new(mp(c)?xl:rr)(c,1);p.version=u;let m=a.get(l);m&&e.remove(m),a.set(l,p)}return{get:function(l,c){return r[c.id]===!0||(c.addEventListener("dispose",s),r[c.id]=!0,t.memory.geometries++),c},update:function(l){let c=l.attributes;for(let d in c)e.update(c[d],i.ARRAY_BUFFER);let h=l.morphAttributes;for(let d in h){let u=h[d];for(let p=0,m=u.length;p<m;p++)e.update(u[p],i.ARRAY_BUFFER)}},getWireframeAttribute:function(l){let c=a.get(l);if(c){let h=l.index;h!==null&&c.version<h.version&&o(l)}else o(l);return a.get(l)}}}function qm(i,e,t,n){let r=n.isWebGL2,a,s,o;this.setMode=function(l){a=l},this.setIndex=function(l){s=l.type,o=l.bytesPerElement},this.render=function(l,c){i.drawElements(a,c,s,l*o),t.update(c,a,1)},this.renderInstances=function(l,c,h){if(h===0)return;let d,u;if(r)d=i,u="drawElementsInstanced";else if(d=e.get("ANGLE_instanced_arrays"),u="drawElementsInstancedANGLE",d===null)return void console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");d[u](a,c,s,l*o,h),t.update(c,a,h)},this.renderMultiDraw=function(l,c,h){if(h===0)return;let d=e.get("WEBGL_multi_draw");if(d===null)for(let u=0;u<h;u++)this.render(l[u]/o,c[u]);else{d.multiDrawElementsWEBGL(a,c,0,s,l,0,h);let u=0;for(let p=0;p<h;p++)u+=c[p];t.update(u,a,1)}}}function Ym(i){let e={frame:0,calls:0,triangles:0,points:0,lines:0};return{memory:{geometries:0,textures:0},render:e,programs:null,autoReset:!0,reset:function(){e.calls=0,e.triangles=0,e.points=0,e.lines=0},update:function(t,n,r){switch(e.calls++,n){case i.TRIANGLES:e.triangles+=r*(t/3);break;case i.LINES:e.lines+=r*(t/2);break;case i.LINE_STRIP:e.lines+=r*(t-1);break;case i.LINE_LOOP:e.lines+=r*t;break;case i.POINTS:e.points+=r*t;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",n)}}}}function Zm(i,e){return i[0]-e[0]}function Jm(i,e){return Math.abs(e[1])-Math.abs(i[1])}function Km(i,e,t){let n={},r=new Float32Array(8),a=new WeakMap,s=new pt,o=[];for(let l=0;l<8;l++)o[l]=[l,0];return{update:function(l,c,h){let d=l.morphTargetInfluences;if(e.isWebGL2===!0){let u=c.morphAttributes.position||c.morphAttributes.normal||c.morphAttributes.color,p=u!==void 0?u.length:0,m=a.get(c);if(m===void 0||m.count!==p){let oe=function(){X.dispose(),a.delete(c),c.removeEventListener("dispose",oe)};m!==void 0&&m.texture.dispose();let y=c.morphAttributes.position!==void 0,x=c.morphAttributes.normal!==void 0,v=c.morphAttributes.color!==void 0,E=c.morphAttributes.position||[],S=c.morphAttributes.normal||[],T=c.morphAttributes.color||[],C=0;y===!0&&(C=1),x===!0&&(C=2),v===!0&&(C=3);let L=c.attributes.position.count*C,I=1;L>e.maxTextureSize&&(I=Math.ceil(L/e.maxTextureSize),L=e.maxTextureSize);let V=new Float32Array(L*I*4*p),X=new gl(V,L,I,p);X.type=ir,X.needsUpdate=!0;let N=4*C;for(let F=0;F<p;F++){let ne=E[F],$=S[F],O=T[F],q=L*I*4*F;for(let se=0;se<ne.count;se++){let Z=se*N;y===!0&&(s.fromBufferAttribute(ne,se),V[q+Z+0]=s.x,V[q+Z+1]=s.y,V[q+Z+2]=s.z,V[q+Z+3]=0),x===!0&&(s.fromBufferAttribute($,se),V[q+Z+4]=s.x,V[q+Z+5]=s.y,V[q+Z+6]=s.z,V[q+Z+7]=0),v===!0&&(s.fromBufferAttribute(O,se),V[q+Z+8]=s.x,V[q+Z+9]=s.y,V[q+Z+10]=s.z,V[q+Z+11]=O.itemSize===4?s.w:1)}}m={count:p,texture:X,size:new Re(L,I)},a.set(c,m),c.addEventListener("dispose",oe)}let g=0;for(let y=0;y<d.length;y++)g+=d[y];let f=c.morphTargetsRelative?1:1-g;h.getUniforms().setValue(i,"morphTargetBaseInfluence",f),h.getUniforms().setValue(i,"morphTargetInfluences",d),h.getUniforms().setValue(i,"morphTargetsTexture",m.texture,t),h.getUniforms().setValue(i,"morphTargetsTextureSize",m.size)}else{let u=d===void 0?0:d.length,p=n[c.id];if(p===void 0||p.length!==u){p=[];for(let x=0;x<u;x++)p[x]=[x,0];n[c.id]=p}for(let x=0;x<u;x++){let v=p[x];v[0]=x,v[1]=d[x]}p.sort(Jm);for(let x=0;x<8;x++)x<u&&p[x][1]?(o[x][0]=p[x][0],o[x][1]=p[x][1]):(o[x][0]=Number.MAX_SAFE_INTEGER,o[x][1]=0);o.sort(Zm);let m=c.morphAttributes.position,g=c.morphAttributes.normal,f=0;for(let x=0;x<8;x++){let v=o[x],E=v[0],S=v[1];E!==Number.MAX_SAFE_INTEGER&&S?(m&&c.getAttribute("morphTarget"+x)!==m[E]&&c.setAttribute("morphTarget"+x,m[E]),g&&c.getAttribute("morphNormal"+x)!==g[E]&&c.setAttribute("morphNormal"+x,g[E]),r[x]=S,f+=S):(m&&c.hasAttribute("morphTarget"+x)===!0&&c.deleteAttribute("morphTarget"+x),g&&c.hasAttribute("morphNormal"+x)===!0&&c.deleteAttribute("morphNormal"+x),r[x]=0)}let y=c.morphTargetsRelative?1:1-f;h.getUniforms().setValue(i,"morphTargetBaseInfluence",y),h.getUniforms().setValue(i,"morphTargetInfluences",r)}}}}function $m(i,e,t,n){let r=new WeakMap;function a(s){let o=s.target;o.removeEventListener("dispose",a),t.remove(o.instanceMatrix),o.instanceColor!==null&&t.remove(o.instanceColor)}return{update:function(s){let o=n.render.frame,l=s.geometry,c=e.get(s,l);if(r.get(c)!==o&&(e.update(c),r.set(c,o)),s.isInstancedMesh&&(s.hasEventListener("dispose",a)===!1&&s.addEventListener("dispose",a),r.get(s)!==o&&(t.update(s.instanceMatrix,i.ARRAY_BUFFER),s.instanceColor!==null&&t.update(s.instanceColor,i.ARRAY_BUFFER),r.set(s,o))),s.isSkinnedMesh){let h=s.skeleton;r.get(h)!==o&&(h.update(),r.set(h,o))}return c},dispose:function(){r=new WeakMap}}}function ls(i,e,t){let n=i[0];if(n<=0||n>0)return i;let r=e*t,a=md[r];if(a===void 0&&(a=new Float32Array(r),md[r]=a),e!==0){n.toArray(a,0);for(let s=1,o=0;s!==e;++s)o+=t,i[s].toArray(a,o)}return a}function oi(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function li(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Bl(i,e){let t=gd[e];t===void 0&&(t=new Int32Array(e),gd[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Qm(i,e){let t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function eg(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(oi(t,e))return;i.uniform2fv(this.addr,e),li(t,e)}}function tg(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)t[0]===e.r&&t[1]===e.g&&t[2]===e.b||(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(oi(t,e))return;i.uniform3fv(this.addr,e),li(t,e)}}function ig(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(oi(t,e))return;i.uniform4fv(this.addr,e),li(t,e)}}function ng(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(oi(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),li(t,e)}else{if(oi(t,n))return;yd.set(n),i.uniformMatrix2fv(this.addr,!1,yd),li(t,n)}}function rg(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(oi(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),li(t,e)}else{if(oi(t,n))return;xd.set(n),i.uniformMatrix3fv(this.addr,!1,xd),li(t,n)}}function ag(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(oi(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),li(t,e)}else{if(oi(t,n))return;vd.set(n),i.uniformMatrix4fv(this.addr,!1,vd),li(t,n)}}function sg(i,e){let t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function og(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(oi(t,e))return;i.uniform2iv(this.addr,e),li(t,e)}}function lg(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(oi(t,e))return;i.uniform3iv(this.addr,e),li(t,e)}}function cg(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(oi(t,e))return;i.uniform4iv(this.addr,e),li(t,e)}}function hg(i,e){let t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function ug(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(oi(t,e))return;i.uniform2uiv(this.addr,e),li(t,e)}}function dg(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(oi(t,e))return;i.uniform3uiv(this.addr,e),li(t,e)}}function pg(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(oi(t,e))return;i.uniform4uiv(this.addr,e),li(t,e)}}function fg(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r);let a=this.type===i.SAMPLER_2D_SHADOW?bp:yp;t.setTexture2D(e||a,r)}function mg(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture3D(e||Mp,r)}function gg(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTextureCube(e||Sp,r)}function vg(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture2DArray(e||_p,r)}function xg(i,e){i.uniform1fv(this.addr,e)}function yg(i,e){let t=ls(e,this.size,2);i.uniform2fv(this.addr,t)}function bg(i,e){let t=ls(e,this.size,3);i.uniform3fv(this.addr,t)}function _g(i,e){let t=ls(e,this.size,4);i.uniform4fv(this.addr,t)}function Mg(i,e){let t=ls(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Sg(i,e){let t=ls(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Tg(i,e){let t=ls(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function Eg(i,e){i.uniform1iv(this.addr,e)}function wg(i,e){i.uniform2iv(this.addr,e)}function Ag(i,e){i.uniform3iv(this.addr,e)}function Rg(i,e){i.uniform4iv(this.addr,e)}function Cg(i,e){i.uniform1uiv(this.addr,e)}function Pg(i,e){i.uniform2uiv(this.addr,e)}function Lg(i,e){i.uniform3uiv(this.addr,e)}function Ig(i,e){i.uniform4uiv(this.addr,e)}function Dg(i,e,t){let n=this.cache,r=e.length,a=Bl(t,r);oi(n,a)||(i.uniform1iv(this.addr,a),li(n,a));for(let s=0;s!==r;++s)t.setTexture2D(e[s]||yp,a[s])}function Ug(i,e,t){let n=this.cache,r=e.length,a=Bl(t,r);oi(n,a)||(i.uniform1iv(this.addr,a),li(n,a));for(let s=0;s!==r;++s)t.setTexture3D(e[s]||Mp,a[s])}function kg(i,e,t){let n=this.cache,r=e.length,a=Bl(t,r);oi(n,a)||(i.uniform1iv(this.addr,a),li(n,a));for(let s=0;s!==r;++s)t.setTextureCube(e[s]||Sp,a[s])}function Ng(i,e,t){let n=this.cache,r=e.length,a=Bl(t,r);oi(n,a)||(i.uniform1iv(this.addr,a),li(n,a));for(let s=0;s!==r;++s)t.setTexture2DArray(e[s]||_p,a[s])}function bd(i,e){i.seq.push(e),i.map[e.id]=e}function Bg(i,e,t){let n=i.name,r=n.length;for(Jc.lastIndex=0;;){let a=Jc.exec(n),s=Jc.lastIndex,o=a[1],l=a[2]==="]",c=a[3];if(l&&(o|=0),c===void 0||c==="["&&s+2===r){bd(t,c===void 0?new _0(o,i,e):new M0(o,i,e));break}{let h=t.map[o];h===void 0&&(h=new S0(o),bd(t,h)),t=h}}}function _d(i,e,t){let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}function Md(i,e,t){let n=i.getShaderParameter(e,i.COMPILE_STATUS),r=i.getShaderInfoLog(e).trim();if(n&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let s=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+(function(o,l){let c=o.split(`
`),h=[],d=Math.max(l-6,0),u=Math.min(l+6,c.length);for(let p=d;p<u;p++){let m=p+1;h.push(`${m===l?">":" "} ${m}: ${c[p]}`)}return h.join(`
`)})(i.getShaderSource(e),s)}return r}function Hg(i,e){let t=(function(n){let r=Rt.getPrimaries(Rt.workingColorSpace),a=Rt.getPrimaries(n),s;switch(r===a?s="":r===hl&&a===cl?s="LinearDisplayP3ToLinearSRGB":r===cl&&a===hl&&(s="LinearSRGBToLinearDisplayP3"),n){case nr:case Nl:return[s,"LinearTransferOETF"];case $t:case uh:return[s,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",n),[s,"LinearTransferOETF"]}})(e);return`vec4 ${i}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function Fg(i,e){let t;switch(e){case ah:t="Linear";break;case sh:t="Reinhard";break;case oh:t="OptimizedCineon";break;case no:t="ACESFilmic";break;case lh:t="AgX";break;case vm:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function ka(i){return i!==""}function Sd(i,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Td(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}function T0(i){return i.replace(Gg,Wg)}function Wg(i,e){let t=ot[e];if(t===void 0){let n=Vg.get(e);if(n===void 0)throw new Error("Can not resolve #include <"+e+">");t=ot[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n)}return T0(t)}function Ed(i){return i.replace(jg,Xg)}function Xg(i,e,t,n){let r="";for(let a=parseInt(e);a<parseInt(t);a++)r+=n.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return r}function wd(i){let e="precision "+i.precision+` float;
precision `+i.precision+" int;";return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function qg(i,e,t,n){let r=i.getContext(),a=t.defines,s=t.vertexShader,o=t.fragmentShader,l=(function(N){let oe="SHADOWMAP_TYPE_BASIC";return N.shadowMapType===np?oe="SHADOWMAP_TYPE_PCF":N.shadowMapType===rh?oe="SHADOWMAP_TYPE_PCF_SOFT":N.shadowMapType===Qn&&(oe="SHADOWMAP_TYPE_VSM"),oe})(t),c=(function(N){let oe="ENVMAP_TYPE_CUBE";if(N.envMap)switch(N.envMapMode){case ja:case Xa:oe="ENVMAP_TYPE_CUBE";break;case kl:oe="ENVMAP_TYPE_CUBE_UV"}return oe})(t),h=(function(N){let oe="ENVMAP_MODE_REFLECTION";return N.envMap&&N.envMapMode===Xa&&(oe="ENVMAP_MODE_REFRACTION"),oe})(t),d=(function(N){let oe="ENVMAP_BLENDING_NONE";if(N.envMap)switch(N.combine){case ap:oe="ENVMAP_BLENDING_MULTIPLY";break;case mm:oe="ENVMAP_BLENDING_MIX";break;case gm:oe="ENVMAP_BLENDING_ADD"}return oe})(t),u=(function(N){let oe=N.envMapCubeUVHeight;if(oe===null)return null;let F=Math.log2(oe)-2,ne=1/oe;return{texelWidth:1/(3*Math.max(Math.pow(2,F),112)),texelHeight:ne,maxMip:F}})(t),p=t.isWebGL2?"":(function(N){return[N.extensionDerivatives||N.envMapCubeUVHeight||N.bumpMap||N.normalMapTangentSpace||N.clearcoatNormalMap||N.flatShading||N.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(N.extensionFragDepth||N.logarithmicDepthBuffer)&&N.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",N.extensionDrawBuffers&&N.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(N.extensionShaderTextureLOD||N.envMap||N.transmission)&&N.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(ka).join(`
`)})(t),m=(function(N){return[N.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(ka).join(`
`)})(t),g=(function(N){let oe=[];for(let F in N){let ne=N[F];ne!==!1&&oe.push("#define "+F+" "+ne)}return oe.join(`
`)})(a),f=r.createProgram(),y,x,v=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(y=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ka).join(`
`),y.length>0&&(y+=`
`),x=[p,"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ka).join(`
`),x.length>0&&(x+=`
`)):(y=[wd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors&&t.isWebGL2?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ka).join(`
`),x=[p,wd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==pr?"#define TONE_MAPPING":"",t.toneMapping!==pr?ot.tonemapping_pars_fragment:"",t.toneMapping!==pr?Fg("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",ot.colorspace_pars_fragment,Hg("linearToOutputTexel",t.outputColorSpace),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ka).join(`
`)),s=T0(s),s=Sd(s,t),s=Td(s,t),o=T0(o),o=Sd(o,t),o=Td(o,t),s=Ed(s),o=Ed(o),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,y=[m,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+y,x=["precision mediump sampler2DArray;","#define varying in",t.glslVersion===ju?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ju?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+x);let E=v+y+s,S=v+x+o,T=_d(r,r.VERTEX_SHADER,E),C=_d(r,r.FRAGMENT_SHADER,S);function L(N){if(i.debug.checkShaderErrors){let oe=r.getProgramInfoLog(f).trim(),F=r.getShaderInfoLog(T).trim(),ne=r.getShaderInfoLog(C).trim(),$=!0,O=!0;if(r.getProgramParameter(f,r.LINK_STATUS)===!1)if($=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(r,f,T,C);else{let q=Md(r,T,"vertex"),se=Md(r,C,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(f,r.VALIDATE_STATUS)+`

Program Info Log: `+oe+`
`+q+`
`+se)}else oe!==""?console.warn("THREE.WebGLProgram: Program Info Log:",oe):F!==""&&ne!==""||(O=!1);O&&(N.diagnostics={runnable:$,programLog:oe,vertexShader:{log:F,prefix:y},fragmentShader:{log:ne,prefix:x}})}r.deleteShader(T),r.deleteShader(C),I=new Wa(r,f),V=(function(oe,F){let ne={},$=oe.getProgramParameter(F,oe.ACTIVE_ATTRIBUTES);for(let O=0;O<$;O++){let q=oe.getActiveAttrib(F,O),se=q.name,Z=1;q.type===oe.FLOAT_MAT2&&(Z=2),q.type===oe.FLOAT_MAT3&&(Z=3),q.type===oe.FLOAT_MAT4&&(Z=4),ne[se]={type:q.type,location:oe.getAttribLocation(F,se),locationSize:Z}}return ne})(r,f)}let I,V;r.attachShader(f,T),r.attachShader(f,C),t.index0AttributeName!==void 0?r.bindAttribLocation(f,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(f,0,"position"),r.linkProgram(f),this.getUniforms=function(){return I===void 0&&L(this),I},this.getAttributes=function(){return V===void 0&&L(this),V};let X=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return X===!1&&(X=r.getProgramParameter(f,Og)),X},this.destroy=function(){n.releaseStatesOfProgram(this),r.deleteProgram(f),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=zg++,this.cacheKey=e,this.usedTimes=1,this.program=f,this.vertexShader=T,this.fragmentShader=C,this}function Zg(i,e,t,n,r,a,s){let o=new vl,l=new E0,c=[],h=r.isWebGL2,d=r.logarithmicDepthBuffer,u=r.vertexTextures,p=r.precision,m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(f){return f===0?"uv":`uv${f}`}return{getParameters:function(f,y,x,v,E){let S=v.fog,T=E.geometry,C=f.isMeshStandardMaterial?v.environment:null,L=(f.isMeshStandardMaterial?t:e).get(f.envMap||C),I=L&&L.mapping===kl?L.image.height:null,V=m[f.type];f.precision!==null&&(p=r.getMaxPrecision(f.precision),p!==f.precision&&console.warn("THREE.WebGLProgram.getParameters:",f.precision,"not supported, using",p,"instead."));let X=T.morphAttributes.position||T.morphAttributes.normal||T.morphAttributes.color,N=X!==void 0?X.length:0,oe,F,ne,$,O=0;if(T.morphAttributes.position!==void 0&&(O=1),T.morphAttributes.normal!==void 0&&(O=2),T.morphAttributes.color!==void 0&&(O=3),V){let Nt=Ln[V];oe=Nt.vertexShader,F=Nt.fragmentShader}else oe=f.vertexShader,F=f.fragmentShader,l.update(f),ne=l.getVertexShaderID(f),$=l.getFragmentShaderID(f);let q=i.getRenderTarget(),se=E.isInstancedMesh===!0,Z=E.isBatchedMesh===!0,te=!!f.map,Ce=!!f.matcap,R=!!L,w=!!f.aoMap,K=!!f.lightMap,W=!!f.bumpMap,U=!!f.normalMap,re=!!f.displacementMap,k=!!f.emissiveMap,H=!!f.metalnessMap,ie=!!f.roughnessMap,ge=f.anisotropy>0,pe=f.clearcoat>0,b=f.iridescence>0,Q=f.sheen>0,G=f.transmission>0,Y=ge&&!!f.anisotropyMap,ce=pe&&!!f.clearcoatMap,xe=pe&&!!f.clearcoatNormalMap,we=pe&&!!f.clearcoatRoughnessMap,_e=b&&!!f.iridescenceMap,Ae=b&&!!f.iridescenceThicknessMap,be=Q&&!!f.sheenColorMap,Te=Q&&!!f.sheenRoughnessMap,Ie=!!f.specularMap,ee=!!f.specularColorMap,le=!!f.specularIntensityMap,ue=G&&!!f.transmissionMap,Me=G&&!!f.thicknessMap,ze=!!f.gradientMap,Je=!!f.alphaMap,Ye=f.alphaTest>0,Ot=!!f.alphaHash,xt=!!f.extensions,Dt=!!T.attributes.uv1,ve=!!T.attributes.uv2,Cn=!!T.attributes.uv3,Fi=pr;return f.toneMapped&&(q!==null&&q.isXRRenderTarget!==!0||(Fi=i.toneMapping)),{isWebGL2:h,shaderID:V,shaderType:f.type,shaderName:f.name,vertexShader:oe,fragmentShader:F,defines:f.defines,customVertexShaderID:ne,customFragmentShaderID:$,isRawShaderMaterial:f.isRawShaderMaterial===!0,glslVersion:f.glslVersion,precision:p,batching:Z,instancing:se,instancingColor:se&&E.instanceColor!==null,supportsVertexTextures:u,outputColorSpace:q===null?i.outputColorSpace:q.isXRRenderTarget===!0?q.texture.colorSpace:nr,map:te,matcap:Ce,envMap:R,envMapMode:R&&L.mapping,envMapCubeUVHeight:I,aoMap:w,lightMap:K,bumpMap:W,normalMap:U,displacementMap:u&&re,emissiveMap:k,normalMapObjectSpace:U&&f.normalMapType===1,normalMapTangentSpace:U&&f.normalMapType===0,metalnessMap:H,roughnessMap:ie,anisotropy:ge,anisotropyMap:Y,clearcoat:pe,clearcoatMap:ce,clearcoatNormalMap:xe,clearcoatRoughnessMap:we,iridescence:b,iridescenceMap:_e,iridescenceThicknessMap:Ae,sheen:Q,sheenColorMap:be,sheenRoughnessMap:Te,specularMap:Ie,specularColorMap:ee,specularIntensityMap:le,transmission:G,transmissionMap:ue,thicknessMap:Me,gradientMap:ze,opaque:f.transparent===!1&&f.blending===1,alphaMap:Je,alphaTest:Ye,alphaHash:Ot,combine:f.combine,mapUv:te&&g(f.map.channel),aoMapUv:w&&g(f.aoMap.channel),lightMapUv:K&&g(f.lightMap.channel),bumpMapUv:W&&g(f.bumpMap.channel),normalMapUv:U&&g(f.normalMap.channel),displacementMapUv:re&&g(f.displacementMap.channel),emissiveMapUv:k&&g(f.emissiveMap.channel),metalnessMapUv:H&&g(f.metalnessMap.channel),roughnessMapUv:ie&&g(f.roughnessMap.channel),anisotropyMapUv:Y&&g(f.anisotropyMap.channel),clearcoatMapUv:ce&&g(f.clearcoatMap.channel),clearcoatNormalMapUv:xe&&g(f.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:we&&g(f.clearcoatRoughnessMap.channel),iridescenceMapUv:_e&&g(f.iridescenceMap.channel),iridescenceThicknessMapUv:Ae&&g(f.iridescenceThicknessMap.channel),sheenColorMapUv:be&&g(f.sheenColorMap.channel),sheenRoughnessMapUv:Te&&g(f.sheenRoughnessMap.channel),specularMapUv:Ie&&g(f.specularMap.channel),specularColorMapUv:ee&&g(f.specularColorMap.channel),specularIntensityMapUv:le&&g(f.specularIntensityMap.channel),transmissionMapUv:ue&&g(f.transmissionMap.channel),thicknessMapUv:Me&&g(f.thicknessMap.channel),alphaMapUv:Je&&g(f.alphaMap.channel),vertexTangents:!!T.attributes.tangent&&(U||ge),vertexColors:f.vertexColors,vertexAlphas:f.vertexColors===!0&&!!T.attributes.color&&T.attributes.color.itemSize===4,vertexUv1s:Dt,vertexUv2s:ve,vertexUv3s:Cn,pointsUvs:E.isPoints===!0&&!!T.attributes.uv&&(te||Je),fog:!!S,useFog:f.fog===!0,fogExp2:S&&S.isFogExp2,flatShading:f.flatShading===!0,sizeAttenuation:f.sizeAttenuation===!0,logarithmicDepthBuffer:d,skinning:E.isSkinnedMesh===!0,morphTargets:T.morphAttributes.position!==void 0,morphNormals:T.morphAttributes.normal!==void 0,morphColors:T.morphAttributes.color!==void 0,morphTargetsCount:N,morphTextureStride:O,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:f.dithering,shadowMapEnabled:i.shadowMap.enabled&&x.length>0,shadowMapType:i.shadowMap.type,toneMapping:Fi,useLegacyLights:i._useLegacyLights,decodeVideoTexture:te&&f.map.isVideoTexture===!0&&Rt.getTransfer(f.map.colorSpace)===Ut,premultipliedAlpha:f.premultipliedAlpha,doubleSided:f.side===2,flipSided:f.side===di,useDepthPacking:f.depthPacking>=0,depthPacking:f.depthPacking||0,index0AttributeName:f.index0AttributeName,extensionDerivatives:xt&&f.extensions.derivatives===!0,extensionFragDepth:xt&&f.extensions.fragDepth===!0,extensionDrawBuffers:xt&&f.extensions.drawBuffers===!0,extensionShaderTextureLOD:xt&&f.extensions.shaderTextureLOD===!0,extensionClipCullDistance:xt&&f.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:h||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:h||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:h||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:f.customProgramCacheKey()}},getProgramCacheKey:function(f){let y=[];if(f.shaderID?y.push(f.shaderID):(y.push(f.customVertexShaderID),y.push(f.customFragmentShaderID)),f.defines!==void 0)for(let x in f.defines)y.push(x),y.push(f.defines[x]);return f.isRawShaderMaterial===!1&&((function(x,v){x.push(v.precision),x.push(v.outputColorSpace),x.push(v.envMapMode),x.push(v.envMapCubeUVHeight),x.push(v.mapUv),x.push(v.alphaMapUv),x.push(v.lightMapUv),x.push(v.aoMapUv),x.push(v.bumpMapUv),x.push(v.normalMapUv),x.push(v.displacementMapUv),x.push(v.emissiveMapUv),x.push(v.metalnessMapUv),x.push(v.roughnessMapUv),x.push(v.anisotropyMapUv),x.push(v.clearcoatMapUv),x.push(v.clearcoatNormalMapUv),x.push(v.clearcoatRoughnessMapUv),x.push(v.iridescenceMapUv),x.push(v.iridescenceThicknessMapUv),x.push(v.sheenColorMapUv),x.push(v.sheenRoughnessMapUv),x.push(v.specularMapUv),x.push(v.specularColorMapUv),x.push(v.specularIntensityMapUv),x.push(v.transmissionMapUv),x.push(v.thicknessMapUv),x.push(v.combine),x.push(v.fogExp2),x.push(v.sizeAttenuation),x.push(v.morphTargetsCount),x.push(v.morphAttributeCount),x.push(v.numDirLights),x.push(v.numPointLights),x.push(v.numSpotLights),x.push(v.numSpotLightMaps),x.push(v.numHemiLights),x.push(v.numRectAreaLights),x.push(v.numDirLightShadows),x.push(v.numPointLightShadows),x.push(v.numSpotLightShadows),x.push(v.numSpotLightShadowsWithMaps),x.push(v.numLightProbes),x.push(v.shadowMapType),x.push(v.toneMapping),x.push(v.numClippingPlanes),x.push(v.numClipIntersection),x.push(v.depthPacking)})(y,f),(function(x,v){o.disableAll(),v.isWebGL2&&o.enable(0),v.supportsVertexTextures&&o.enable(1),v.instancing&&o.enable(2),v.instancingColor&&o.enable(3),v.matcap&&o.enable(4),v.envMap&&o.enable(5),v.normalMapObjectSpace&&o.enable(6),v.normalMapTangentSpace&&o.enable(7),v.clearcoat&&o.enable(8),v.iridescence&&o.enable(9),v.alphaTest&&o.enable(10),v.vertexColors&&o.enable(11),v.vertexAlphas&&o.enable(12),v.vertexUv1s&&o.enable(13),v.vertexUv2s&&o.enable(14),v.vertexUv3s&&o.enable(15),v.vertexTangents&&o.enable(16),v.anisotropy&&o.enable(17),v.alphaHash&&o.enable(18),v.batching&&o.enable(19),x.push(o.mask),o.disableAll(),v.fog&&o.enable(0),v.useFog&&o.enable(1),v.flatShading&&o.enable(2),v.logarithmicDepthBuffer&&o.enable(3),v.skinning&&o.enable(4),v.morphTargets&&o.enable(5),v.morphNormals&&o.enable(6),v.morphColors&&o.enable(7),v.premultipliedAlpha&&o.enable(8),v.shadowMapEnabled&&o.enable(9),v.useLegacyLights&&o.enable(10),v.doubleSided&&o.enable(11),v.flipSided&&o.enable(12),v.useDepthPacking&&o.enable(13),v.dithering&&o.enable(14),v.transmission&&o.enable(15),v.sheen&&o.enable(16),v.opaque&&o.enable(17),v.pointsUvs&&o.enable(18),v.decodeVideoTexture&&o.enable(19),x.push(o.mask)})(y,f),y.push(i.outputColorSpace)),y.push(f.customProgramCacheKey),y.join()},getUniforms:function(f){let y=m[f.type],x;if(y){let v=Ln[y];x=xr.clone(v.uniforms)}else x=f.uniforms;return x},acquireProgram:function(f,y){let x;for(let v=0,E=c.length;v<E;v++){let S=c[v];if(S.cacheKey===y){x=S,++x.usedTimes;break}}return x===void 0&&(x=new qg(i,y,f,a),c.push(x)),x},releaseProgram:function(f){if(--f.usedTimes==0){let y=c.indexOf(f);c[y]=c[c.length-1],c.pop(),f.destroy()}},releaseShaderCache:function(f){l.remove(f)},programs:c,dispose:function(){l.dispose()}}}function Jg(){let i=new WeakMap;return{get:function(e){let t=i.get(e);return t===void 0&&(t={},i.set(e,t)),t},remove:function(e){i.delete(e)},update:function(e,t,n){i.get(e)[t]=n},dispose:function(){i=new WeakMap}}}function Kg(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function Ad(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Rd(){let i=[],e=0,t=[],n=[],r=[];function a(s,o,l,c,h,d){let u=i[e];return u===void 0?(u={id:s.id,object:s,geometry:o,material:l,groupOrder:c,renderOrder:s.renderOrder,z:h,group:d},i[e]=u):(u.id=s.id,u.object=s,u.geometry=o,u.material=l,u.groupOrder=c,u.renderOrder=s.renderOrder,u.z=h,u.group=d),e++,u}return{opaque:t,transmissive:n,transparent:r,init:function(){e=0,t.length=0,n.length=0,r.length=0},push:function(s,o,l,c,h,d){let u=a(s,o,l,c,h,d);l.transmission>0?n.push(u):l.transparent===!0?r.push(u):t.push(u)},unshift:function(s,o,l,c,h,d){let u=a(s,o,l,c,h,d);l.transmission>0?n.unshift(u):l.transparent===!0?r.unshift(u):t.unshift(u)},finish:function(){for(let s=e,o=i.length;s<o;s++){let l=i[s];if(l.id===null)break;l.id=null,l.object=null,l.geometry=null,l.material=null,l.group=null}},sort:function(s,o){t.length>1&&t.sort(s||Kg),n.length>1&&n.sort(o||Ad),r.length>1&&r.sort(o||Ad)}}}function $g(){let i=new WeakMap;return{get:function(e,t){let n=i.get(e),r;return n===void 0?(r=new Rd,i.set(e,[r])):t>=n.length?(r=new Rd,n.push(r)):r=n[t],r},dispose:function(){i=new WeakMap}}}function Qg(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new D,color:new ke};break;case"SpotLight":t={position:new D,direction:new D,color:new ke,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new D,color:new ke,distance:0,decay:0};break;case"HemisphereLight":t={direction:new D,skyColor:new ke,groundColor:new ke};break;case"RectAreaLight":t={color:new ke,position:new D,halfWidth:new D,halfHeight:new D}}return i[e.id]=t,t}}}function t1(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function i1(i,e){let t=new Qg,n=(function(){let l={};return{get:function(c){if(l[c.id]!==void 0)return l[c.id];let h;switch(c.type){case"DirectionalLight":case"SpotLight":h={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re};break;case"PointLight":h={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re,shadowCameraNear:1,shadowCameraFar:1e3}}return l[c.id]=h,h}}})(),r={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)r.probe.push(new D);let a=new D,s=new Ze,o=new Ze;return{setup:function(l,c){let h=0,d=0,u=0;for(let V=0;V<9;V++)r.probe[V].set(0,0,0);let p=0,m=0,g=0,f=0,y=0,x=0,v=0,E=0,S=0,T=0,C=0;l.sort(t1);let L=c===!0?Math.PI:1;for(let V=0,X=l.length;V<X;V++){let N=l[V],oe=N.color,F=N.intensity,ne=N.distance,$=N.shadow&&N.shadow.map?N.shadow.map.texture:null;if(N.isAmbientLight)h+=oe.r*F*L,d+=oe.g*F*L,u+=oe.b*F*L;else if(N.isLightProbe){for(let O=0;O<9;O++)r.probe[O].addScaledVector(N.sh.coefficients[O],F);C++}else if(N.isDirectionalLight){let O=t.get(N);if(O.color.copy(N.color).multiplyScalar(N.intensity*L),N.castShadow){let q=N.shadow,se=n.get(N);se.shadowBias=q.bias,se.shadowNormalBias=q.normalBias,se.shadowRadius=q.radius,se.shadowMapSize=q.mapSize,r.directionalShadow[p]=se,r.directionalShadowMap[p]=$,r.directionalShadowMatrix[p]=N.shadow.matrix,x++}r.directional[p]=O,p++}else if(N.isSpotLight){let O=t.get(N);O.position.setFromMatrixPosition(N.matrixWorld),O.color.copy(oe).multiplyScalar(F*L),O.distance=ne,O.coneCos=Math.cos(N.angle),O.penumbraCos=Math.cos(N.angle*(1-N.penumbra)),O.decay=N.decay,r.spot[g]=O;let q=N.shadow;if(N.map&&(r.spotLightMap[S]=N.map,S++,q.updateMatrices(N),N.castShadow&&T++),r.spotLightMatrix[g]=q.matrix,N.castShadow){let se=n.get(N);se.shadowBias=q.bias,se.shadowNormalBias=q.normalBias,se.shadowRadius=q.radius,se.shadowMapSize=q.mapSize,r.spotShadow[g]=se,r.spotShadowMap[g]=$,E++}g++}else if(N.isRectAreaLight){let O=t.get(N);O.color.copy(oe).multiplyScalar(F),O.halfWidth.set(.5*N.width,0,0),O.halfHeight.set(0,.5*N.height,0),r.rectArea[f]=O,f++}else if(N.isPointLight){let O=t.get(N);if(O.color.copy(N.color).multiplyScalar(N.intensity*L),O.distance=N.distance,O.decay=N.decay,N.castShadow){let q=N.shadow,se=n.get(N);se.shadowBias=q.bias,se.shadowNormalBias=q.normalBias,se.shadowRadius=q.radius,se.shadowMapSize=q.mapSize,se.shadowCameraNear=q.camera.near,se.shadowCameraFar=q.camera.far,r.pointShadow[m]=se,r.pointShadowMap[m]=$,r.pointShadowMatrix[m]=N.shadow.matrix,v++}r.point[m]=O,m++}else if(N.isHemisphereLight){let O=t.get(N);O.skyColor.copy(N.color).multiplyScalar(F*L),O.groundColor.copy(N.groundColor).multiplyScalar(F*L),r.hemi[y]=O,y++}}f>0&&(e.isWebGL2?i.has("OES_texture_float_linear")===!0?(r.rectAreaLTC1=Be.LTC_FLOAT_1,r.rectAreaLTC2=Be.LTC_FLOAT_2):(r.rectAreaLTC1=Be.LTC_HALF_1,r.rectAreaLTC2=Be.LTC_HALF_2):i.has("OES_texture_float_linear")===!0?(r.rectAreaLTC1=Be.LTC_FLOAT_1,r.rectAreaLTC2=Be.LTC_FLOAT_2):i.has("OES_texture_half_float_linear")===!0?(r.rectAreaLTC1=Be.LTC_HALF_1,r.rectAreaLTC2=Be.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),r.ambient[0]=h,r.ambient[1]=d,r.ambient[2]=u;let I=r.hash;I.directionalLength===p&&I.pointLength===m&&I.spotLength===g&&I.rectAreaLength===f&&I.hemiLength===y&&I.numDirectionalShadows===x&&I.numPointShadows===v&&I.numSpotShadows===E&&I.numSpotMaps===S&&I.numLightProbes===C||(r.directional.length=p,r.spot.length=g,r.rectArea.length=f,r.point.length=m,r.hemi.length=y,r.directionalShadow.length=x,r.directionalShadowMap.length=x,r.pointShadow.length=v,r.pointShadowMap.length=v,r.spotShadow.length=E,r.spotShadowMap.length=E,r.directionalShadowMatrix.length=x,r.pointShadowMatrix.length=v,r.spotLightMatrix.length=E+S-T,r.spotLightMap.length=S,r.numSpotLightShadowsWithMaps=T,r.numLightProbes=C,I.directionalLength=p,I.pointLength=m,I.spotLength=g,I.rectAreaLength=f,I.hemiLength=y,I.numDirectionalShadows=x,I.numPointShadows=v,I.numSpotShadows=E,I.numSpotMaps=S,I.numLightProbes=C,r.version=e1++)},setupView:function(l,c){let h=0,d=0,u=0,p=0,m=0,g=c.matrixWorldInverse;for(let f=0,y=l.length;f<y;f++){let x=l[f];if(x.isDirectionalLight){let v=r.directional[h];v.direction.setFromMatrixPosition(x.matrixWorld),a.setFromMatrixPosition(x.target.matrixWorld),v.direction.sub(a),v.direction.transformDirection(g),h++}else if(x.isSpotLight){let v=r.spot[u];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(g),v.direction.setFromMatrixPosition(x.matrixWorld),a.setFromMatrixPosition(x.target.matrixWorld),v.direction.sub(a),v.direction.transformDirection(g),u++}else if(x.isRectAreaLight){let v=r.rectArea[p];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(g),o.identity(),s.copy(x.matrixWorld),s.premultiply(g),o.extractRotation(s),v.halfWidth.set(.5*x.width,0,0),v.halfHeight.set(0,.5*x.height,0),v.halfWidth.applyMatrix4(o),v.halfHeight.applyMatrix4(o),p++}else if(x.isPointLight){let v=r.point[d];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(g),d++}else if(x.isHemisphereLight){let v=r.hemi[m];v.direction.setFromMatrixPosition(x.matrixWorld),v.direction.transformDirection(g),m++}}},state:r}}function Cd(i,e){let t=new i1(i,e),n=[],r=[];return{init:function(){n.length=0,r.length=0},state:{lightsArray:n,shadowsArray:r,lights:t},setupLights:function(a){t.setup(n,a)},setupLightsView:function(a){t.setupView(n,a)},pushLight:function(a){n.push(a)},pushShadow:function(a){r.push(a)}}}function n1(i,e){let t=new WeakMap;return{get:function(n,r=0){let a=t.get(n),s;return a===void 0?(s=new Cd(i,e),t.set(n,[s])):r>=a.length?(s=new Cd(i,e),a.push(s)):s=a[r],s},dispose:function(){t=new WeakMap}}}function r1(i,e,t){let n=new es,r=new Re,a=new Re,s=new pt,o=new A0({depthPacking:3201}),l=new R0,c={},h=t.maxTextureSize,d={[ni]:di,[di]:ni,2:2},u=new qt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Re},radius:{value:4}},vertexShader:`void main() {
	gl_Position = vec4( position, 1.0 );
}`,fragmentShader:`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`}),p=u.clone();p.defines.HORIZONTAL_PASS=1;let m=new ut;m.setAttribute("position",new jt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let g=new yt(m,u),f=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=np;let y=this.type;function x(T,C){let L=e.update(g);u.defines.VSM_SAMPLES!==T.blurSamples&&(u.defines.VSM_SAMPLES=T.blurSamples,p.defines.VSM_SAMPLES=T.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new _i(r.x,r.y)),u.uniforms.shadow_pass.value=T.map.texture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(C,null,L,u,g,null),p.uniforms.shadow_pass.value=T.mapPass.texture,p.uniforms.resolution.value=T.mapSize,p.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(C,null,L,p,g,null)}function v(T,C,L,I){let V=null,X=L.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(X!==void 0)V=X;else if(V=L.isPointLight===!0?l:o,i.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0){let N=V.uuid,oe=C.uuid,F=c[N];F===void 0&&(F={},c[N]=F);let ne=F[oe];ne===void 0&&(ne=V.clone(),F[oe]=ne,C.addEventListener("dispose",S)),V=ne}return V.visible=C.visible,V.wireframe=C.wireframe,V.side=I===Qn?C.shadowSide!==null?C.shadowSide:C.side:C.shadowSide!==null?C.shadowSide:d[C.side],V.alphaMap=C.alphaMap,V.alphaTest=C.alphaTest,V.map=C.map,V.clipShadows=C.clipShadows,V.clippingPlanes=C.clippingPlanes,V.clipIntersection=C.clipIntersection,V.displacementMap=C.displacementMap,V.displacementScale=C.displacementScale,V.displacementBias=C.displacementBias,V.wireframeLinewidth=C.wireframeLinewidth,V.linewidth=C.linewidth,L.isPointLight===!0&&V.isMeshDistanceMaterial===!0&&(i.properties.get(V).light=L),V}function E(T,C,L,I,V){if(T.visible===!1)return;if(T.layers.test(C.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&V===Qn)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,T.matrixWorld);let N=e.update(T),oe=T.material;if(Array.isArray(oe)){let F=N.groups;for(let ne=0,$=F.length;ne<$;ne++){let O=F[ne],q=oe[O.materialIndex];if(q&&q.visible){let se=v(T,q,I,V);T.onBeforeShadow(i,T,C,L,N,se,O),i.renderBufferDirect(L,null,N,se,T,O),T.onAfterShadow(i,T,C,L,N,se,O)}}}else if(oe.visible){let F=v(T,oe,I,V);T.onBeforeShadow(i,T,C,L,N,F,null),i.renderBufferDirect(L,null,N,F,T,null),T.onAfterShadow(i,T,C,L,N,F,null)}}let X=T.children;for(let N=0,oe=X.length;N<oe;N++)E(X[N],C,L,I,V)}function S(T){T.target.removeEventListener("dispose",S);for(let C in c){let L=c[C],I=T.target.uuid;I in L&&(L[I].dispose(),delete L[I])}}this.render=function(T,C,L){if(f.enabled===!1||f.autoUpdate===!1&&f.needsUpdate===!1||T.length===0)return;let I=i.getRenderTarget(),V=i.getActiveCubeFace(),X=i.getActiveMipmapLevel(),N=i.state;N.setBlending(0),N.buffers.color.setClear(1,1,1,1),N.buffers.depth.setTest(!0),N.setScissorTest(!1);let oe=y!==Qn&&this.type===Qn,F=y===Qn&&this.type!==Qn;for(let ne=0,$=T.length;ne<$;ne++){let O=T[ne],q=O.shadow;if(q===void 0){console.warn("THREE.WebGLShadowMap:",O,"has no shadow.");continue}if(q.autoUpdate===!1&&q.needsUpdate===!1)continue;r.copy(q.mapSize);let se=q.getFrameExtents();if(r.multiply(se),a.copy(q.mapSize),(r.x>h||r.y>h)&&(r.x>h&&(a.x=Math.floor(h/se.x),r.x=a.x*se.x,q.mapSize.x=a.x),r.y>h&&(a.y=Math.floor(h/se.y),r.y=a.y*se.y,q.mapSize.y=a.y)),q.map===null||oe===!0||F===!0){let te=this.type!==Qn?{minFilter:hi,magFilter:hi}:{};q.map!==null&&q.map.dispose(),q.map=new _i(r.x,r.y,te),q.map.texture.name=O.name+".shadowMap",q.camera.updateProjectionMatrix()}i.setRenderTarget(q.map),i.clear();let Z=q.getViewportCount();for(let te=0;te<Z;te++){let Ce=q.getViewport(te);s.set(a.x*Ce.x,a.y*Ce.y,a.x*Ce.z,a.y*Ce.w),N.viewport(s),q.updateMatrices(O,te),n=q.getFrustum(),E(C,L,q.camera,O,this.type)}q.isPointLightShadow!==!0&&this.type===Qn&&x(q,L),q.needsUpdate=!1}y=this.type,f.needsUpdate=!1,i.setRenderTarget(I,V,X)}}function a1(i,e,t){let n=t.isWebGL2,r=new function(){let b=!1,Q=new pt,G=null,Y=new pt(0,0,0,0);return{setMask:function(ce){G===ce||b||(i.colorMask(ce,ce,ce,ce),G=ce)},setLocked:function(ce){b=ce},setClear:function(ce,xe,we,_e,Ae){Ae===!0&&(ce*=_e,xe*=_e,we*=_e),Q.set(ce,xe,we,_e),Y.equals(Q)===!1&&(i.clearColor(ce,xe,we,_e),Y.copy(Q))},reset:function(){b=!1,G=null,Y.set(-1,0,0,0)}}},a=new function(){let b=!1,Q=null,G=null,Y=null;return{setTest:function(ce){ce?W(i.DEPTH_TEST):U(i.DEPTH_TEST)},setMask:function(ce){Q===ce||b||(i.depthMask(ce),Q=ce)},setFunc:function(ce){if(G!==ce){switch(ce){case 0:i.depthFunc(i.NEVER);break;case 1:i.depthFunc(i.ALWAYS);break;case 2:i.depthFunc(i.LESS);break;case 3:default:i.depthFunc(i.LEQUAL);break;case 4:i.depthFunc(i.EQUAL);break;case 5:i.depthFunc(i.GEQUAL);break;case 6:i.depthFunc(i.GREATER);break;case 7:i.depthFunc(i.NOTEQUAL)}G=ce}},setLocked:function(ce){b=ce},setClear:function(ce){Y!==ce&&(i.clearDepth(ce),Y=ce)},reset:function(){b=!1,Q=null,G=null,Y=null}}},s=new function(){let b=!1,Q=null,G=null,Y=null,ce=null,xe=null,we=null,_e=null,Ae=null;return{setTest:function(be){b||(be?W(i.STENCIL_TEST):U(i.STENCIL_TEST))},setMask:function(be){Q===be||b||(i.stencilMask(be),Q=be)},setFunc:function(be,Te,Ie){G===be&&Y===Te&&ce===Ie||(i.stencilFunc(be,Te,Ie),G=be,Y=Te,ce=Ie)},setOp:function(be,Te,Ie){xe===be&&we===Te&&_e===Ie||(i.stencilOp(be,Te,Ie),xe=be,we=Te,_e=Ie)},setLocked:function(be){b=be},setClear:function(be){Ae!==be&&(i.clearStencil(be),Ae=be)},reset:function(){b=!1,Q=null,G=null,Y=null,ce=null,xe=null,we=null,_e=null,Ae=null}}},o=new WeakMap,l=new WeakMap,c={},h={},d=new WeakMap,u=[],p=null,m=!1,g=null,f=null,y=null,x=null,v=null,E=null,S=null,T=new ke(0,0,0),C=0,L=!1,I=null,V=null,X=null,N=null,oe=null,F=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),ne=!1,$=0,O=i.getParameter(i.VERSION);O.indexOf("WebGL")!==-1?($=parseFloat(/^WebGL (\d)/.exec(O)[1]),ne=$>=1):O.indexOf("OpenGL ES")!==-1&&($=parseFloat(/^OpenGL ES (\d)/.exec(O)[1]),ne=$>=2);let q=null,se={},Z=i.getParameter(i.SCISSOR_BOX),te=i.getParameter(i.VIEWPORT),Ce=new pt().fromArray(Z),R=new pt().fromArray(te);function w(b,Q,G,Y){let ce=new Uint8Array(4),xe=i.createTexture();i.bindTexture(b,xe),i.texParameteri(b,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(b,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let we=0;we<G;we++)!n||b!==i.TEXTURE_3D&&b!==i.TEXTURE_2D_ARRAY?i.texImage2D(Q+we,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,ce):i.texImage3D(Q,0,i.RGBA,1,1,Y,0,i.RGBA,i.UNSIGNED_BYTE,ce);return xe}let K={};function W(b){c[b]!==!0&&(i.enable(b),c[b]=!0)}function U(b){c[b]!==!1&&(i.disable(b),c[b]=!1)}K[i.TEXTURE_2D]=w(i.TEXTURE_2D,i.TEXTURE_2D,1),K[i.TEXTURE_CUBE_MAP]=w(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(K[i.TEXTURE_2D_ARRAY]=w(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),K[i.TEXTURE_3D]=w(i.TEXTURE_3D,i.TEXTURE_3D,1,1)),r.setClear(0,0,0,1),a.setClear(1),s.setClear(0),W(i.DEPTH_TEST),a.setFunc(3),ie(!1),ge(1),W(i.CULL_FACE),H(0);let re={[Hr]:i.FUNC_ADD,101:i.FUNC_SUBTRACT,102:i.FUNC_REVERSE_SUBTRACT};if(n)re[103]=i.MIN,re[104]=i.MAX;else{let b=e.get("EXT_blend_minmax");b!==null&&(re[103]=b.MIN_EXT,re[104]=b.MAX_EXT)}let k={200:i.ZERO,201:i.ONE,202:i.SRC_COLOR,[l0]:i.SRC_ALPHA,210:i.SRC_ALPHA_SATURATE,208:i.DST_COLOR,206:i.DST_ALPHA,203:i.ONE_MINUS_SRC_COLOR,[c0]:i.ONE_MINUS_SRC_ALPHA,209:i.ONE_MINUS_DST_COLOR,207:i.ONE_MINUS_DST_ALPHA,211:i.CONSTANT_COLOR,212:i.ONE_MINUS_CONSTANT_COLOR,213:i.CONSTANT_ALPHA,214:i.ONE_MINUS_CONSTANT_ALPHA};function H(b,Q,G,Y,ce,xe,we,_e,Ae,be){if(b!==0){if(m===!1&&(W(i.BLEND),m=!0),b===5)ce=ce||Q,xe=xe||G,we=we||Y,Q===f&&ce===v||(i.blendEquationSeparate(re[Q],re[ce]),f=Q,v=ce),G===y&&Y===x&&xe===E&&we===S||(i.blendFuncSeparate(k[G],k[Y],k[xe],k[we]),y=G,x=Y,E=xe,S=we),_e.equals(T)!==!1&&Ae===C||(i.blendColor(_e.r,_e.g,_e.b,Ae),T.copy(_e),C=Ae),g=b,L=!1;else if(b!==g||be!==L){if(f===Hr&&v===Hr||(i.blendEquation(i.FUNC_ADD),f=Hr,v=Hr),be)switch(b){case 1:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case 2:i.blendFunc(i.ONE,i.ONE);break;case 3:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case 4:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",b)}else switch(b){case 1:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case 2:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case 3:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case 4:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",b)}y=null,x=null,E=null,S=null,T.set(0,0,0),C=0,g=b,L=be}}else m===!0&&(U(i.BLEND),m=!1)}function ie(b){I!==b&&(b?i.frontFace(i.CW):i.frontFace(i.CCW),I=b)}function ge(b){b!==0?(W(i.CULL_FACE),b!==V&&(b===1?i.cullFace(i.BACK):b===2?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):U(i.CULL_FACE),V=b}function pe(b,Q,G){b?(W(i.POLYGON_OFFSET_FILL),N===Q&&oe===G||(i.polygonOffset(Q,G),N=Q,oe=G)):U(i.POLYGON_OFFSET_FILL)}return{buffers:{color:r,depth:a,stencil:s},enable:W,disable:U,bindFramebuffer:function(b,Q){return h[b]!==Q&&(i.bindFramebuffer(b,Q),h[b]=Q,n&&(b===i.DRAW_FRAMEBUFFER&&(h[i.FRAMEBUFFER]=Q),b===i.FRAMEBUFFER&&(h[i.DRAW_FRAMEBUFFER]=Q)),!0)},drawBuffers:function(b,Q){let G=u,Y=!1;if(b)if(G=d.get(Q),G===void 0&&(G=[],d.set(Q,G)),b.isWebGLMultipleRenderTargets){let ce=b.texture;if(G.length!==ce.length||G[0]!==i.COLOR_ATTACHMENT0){for(let xe=0,we=ce.length;xe<we;xe++)G[xe]=i.COLOR_ATTACHMENT0+xe;G.length=ce.length,Y=!0}}else G[0]!==i.COLOR_ATTACHMENT0&&(G[0]=i.COLOR_ATTACHMENT0,Y=!0);else G[0]!==i.BACK&&(G[0]=i.BACK,Y=!0);Y&&(t.isWebGL2?i.drawBuffers(G):e.get("WEBGL_draw_buffers").drawBuffersWEBGL(G))},useProgram:function(b){return p!==b&&(i.useProgram(b),p=b,!0)},setBlending:H,setMaterial:function(b,Q){b.side===2?U(i.CULL_FACE):W(i.CULL_FACE);let G=b.side===di;Q&&(G=!G),ie(G),b.blending===1&&b.transparent===!1?H(0):H(b.blending,b.blendEquation,b.blendSrc,b.blendDst,b.blendEquationAlpha,b.blendSrcAlpha,b.blendDstAlpha,b.blendColor,b.blendAlpha,b.premultipliedAlpha),a.setFunc(b.depthFunc),a.setTest(b.depthTest),a.setMask(b.depthWrite),r.setMask(b.colorWrite);let Y=b.stencilWrite;s.setTest(Y),Y&&(s.setMask(b.stencilWriteMask),s.setFunc(b.stencilFunc,b.stencilRef,b.stencilFuncMask),s.setOp(b.stencilFail,b.stencilZFail,b.stencilZPass)),pe(b.polygonOffset,b.polygonOffsetFactor,b.polygonOffsetUnits),b.alphaToCoverage===!0?W(i.SAMPLE_ALPHA_TO_COVERAGE):U(i.SAMPLE_ALPHA_TO_COVERAGE)},setFlipSided:ie,setCullFace:ge,setLineWidth:function(b){b!==X&&(ne&&i.lineWidth(b),X=b)},setPolygonOffset:pe,setScissorTest:function(b){b?W(i.SCISSOR_TEST):U(i.SCISSOR_TEST)},activeTexture:function(b){b===void 0&&(b=i.TEXTURE0+F-1),q!==b&&(i.activeTexture(b),q=b)},bindTexture:function(b,Q,G){G===void 0&&(G=q===null?i.TEXTURE0+F-1:q);let Y=se[G];Y===void 0&&(Y={type:void 0,texture:void 0},se[G]=Y),Y.type===b&&Y.texture===Q||(q!==G&&(i.activeTexture(G),q=G),i.bindTexture(b,Q||K[b]),Y.type=b,Y.texture=Q)},unbindTexture:function(){let b=se[q];b!==void 0&&b.type!==void 0&&(i.bindTexture(b.type,null),b.type=void 0,b.texture=void 0)},compressedTexImage2D:function(){try{i.compressedTexImage2D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},compressedTexImage3D:function(){try{i.compressedTexImage3D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},texImage2D:function(){try{i.texImage2D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},texImage3D:function(){try{i.texImage3D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},updateUBOMapping:function(b,Q){let G=l.get(Q);G===void 0&&(G=new WeakMap,l.set(Q,G));let Y=G.get(b);Y===void 0&&(Y=i.getUniformBlockIndex(Q,b.name),G.set(b,Y))},uniformBlockBinding:function(b,Q){let G=l.get(Q).get(b);o.get(Q)!==G&&(i.uniformBlockBinding(Q,G,b.__bindingPointIndex),o.set(Q,G))},texStorage2D:function(){try{i.texStorage2D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},texStorage3D:function(){try{i.texStorage3D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},texSubImage2D:function(){try{i.texSubImage2D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},texSubImage3D:function(){try{i.texSubImage3D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},compressedTexSubImage2D:function(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},compressedTexSubImage3D:function(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(b){console.error("THREE.WebGLState:",b)}},scissor:function(b){Ce.equals(b)===!1&&(i.scissor(b.x,b.y,b.z,b.w),Ce.copy(b))},viewport:function(b){R.equals(b)===!1&&(i.viewport(b.x,b.y,b.z,b.w),R.copy(b))},reset:function(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),n===!0&&(i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null)),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),c={},q=null,se={},h={},d=new WeakMap,u=[],p=null,m=!1,g=null,f=null,y=null,x=null,v=null,E=null,S=null,T=new ke(0,0,0),C=0,L=!1,I=null,V=null,X=null,N=null,oe=null,Ce.set(0,0,i.canvas.width,i.canvas.height),R.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),s.reset()}}}function s1(i,e,t,n,r,a,s){let o=r.isWebGL2,l=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator<"u"&&/OculusBrowser/g.test(navigator.userAgent),h=new WeakMap,d,u=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(R,w){return p?new OffscreenCanvas(R,w):pl("canvas")}function g(R,w,K,W){let U=1;if((R.width>W||R.height>W)&&(U=W/Math.max(R.width,R.height)),U<1||w===!0){if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap){let re=w?dl:Math.floor,k=re(U*R.width),H=re(U*R.height);d===void 0&&(d=m(k,H));let ie=K?m(k,H):d;return ie.width=k,ie.height=H,ie.getContext("2d").drawImage(R,0,0,k,H),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+R.width+"x"+R.height+") to ("+k+"x"+H+")."),ie}return"data"in R&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+R.width+"x"+R.height+")."),R}return R}function f(R){return g0(R.width)&&g0(R.height)}function y(R,w){return R.generateMipmaps&&w&&R.minFilter!==hi&&R.minFilter!==_n}function x(R){i.generateMipmap(R)}function v(R,w,K,W,U=!1){if(o===!1)return w;if(R!==null){if(i[R]!==void 0)return i[R];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let re=w;if(w===i.RED&&(K===i.FLOAT&&(re=i.R32F),K===i.HALF_FLOAT&&(re=i.R16F),K===i.UNSIGNED_BYTE&&(re=i.R8)),w===i.RED_INTEGER&&(K===i.UNSIGNED_BYTE&&(re=i.R8UI),K===i.UNSIGNED_SHORT&&(re=i.R16UI),K===i.UNSIGNED_INT&&(re=i.R32UI),K===i.BYTE&&(re=i.R8I),K===i.SHORT&&(re=i.R16I),K===i.INT&&(re=i.R32I)),w===i.RG&&(K===i.FLOAT&&(re=i.RG32F),K===i.HALF_FLOAT&&(re=i.RG16F),K===i.UNSIGNED_BYTE&&(re=i.RG8)),w===i.RGBA){let k=U?ll:Rt.getTransfer(W);K===i.FLOAT&&(re=i.RGBA32F),K===i.HALF_FLOAT&&(re=i.RGBA16F),K===i.UNSIGNED_BYTE&&(re=k===Ut?i.SRGB8_ALPHA8:i.RGBA8),K===i.UNSIGNED_SHORT_4_4_4_4&&(re=i.RGBA4),K===i.UNSIGNED_SHORT_5_5_5_1&&(re=i.RGB5_A1)}return re!==i.R16F&&re!==i.R32F&&re!==i.RG16F&&re!==i.RG32F&&re!==i.RGBA16F&&re!==i.RGBA32F||e.get("EXT_color_buffer_float"),re}function E(R,w,K){return y(R,K)===!0||R.isFramebufferTexture&&R.minFilter!==hi&&R.minFilter!==_n?Math.log2(Math.max(w.width,w.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?w.mipmaps.length:1}function S(R){return R===hi||R===gu||R===Mc?i.NEAREST:i.LINEAR}function T(R){let w=R.target;w.removeEventListener("dispose",T),(function(K){let W=n.get(K);if(W.__webglInit===void 0)return;let U=K.source,re=u.get(U);if(re){let k=re[W.__cacheKey];k.usedTimes--,k.usedTimes===0&&L(K),Object.keys(re).length===0&&u.delete(U)}n.remove(K)})(w),w.isVideoTexture&&h.delete(w)}function C(R){let w=R.target;w.removeEventListener("dispose",C),(function(K){let W=K.texture,U=n.get(K),re=n.get(W);if(re.__webglTexture!==void 0&&(i.deleteTexture(re.__webglTexture),s.memory.textures--),K.depthTexture&&K.depthTexture.dispose(),K.isWebGLCubeRenderTarget)for(let k=0;k<6;k++){if(Array.isArray(U.__webglFramebuffer[k]))for(let H=0;H<U.__webglFramebuffer[k].length;H++)i.deleteFramebuffer(U.__webglFramebuffer[k][H]);else i.deleteFramebuffer(U.__webglFramebuffer[k]);U.__webglDepthbuffer&&i.deleteRenderbuffer(U.__webglDepthbuffer[k])}else{if(Array.isArray(U.__webglFramebuffer))for(let k=0;k<U.__webglFramebuffer.length;k++)i.deleteFramebuffer(U.__webglFramebuffer[k]);else i.deleteFramebuffer(U.__webglFramebuffer);if(U.__webglDepthbuffer&&i.deleteRenderbuffer(U.__webglDepthbuffer),U.__webglMultisampledFramebuffer&&i.deleteFramebuffer(U.__webglMultisampledFramebuffer),U.__webglColorRenderbuffer)for(let k=0;k<U.__webglColorRenderbuffer.length;k++)U.__webglColorRenderbuffer[k]&&i.deleteRenderbuffer(U.__webglColorRenderbuffer[k]);U.__webglDepthRenderbuffer&&i.deleteRenderbuffer(U.__webglDepthRenderbuffer)}if(K.isWebGLMultipleRenderTargets)for(let k=0,H=W.length;k<H;k++){let ie=n.get(W[k]);ie.__webglTexture&&(i.deleteTexture(ie.__webglTexture),s.memory.textures--),n.remove(W[k])}n.remove(W),n.remove(K)})(w)}function L(R){let w=n.get(R);i.deleteTexture(w.__webglTexture);let K=R.source;delete u.get(K)[w.__cacheKey],s.memory.textures--}let I=0;function V(R,w){let K=n.get(R);if(R.isVideoTexture&&(function(W){let U=s.render.frame;h.get(W)!==U&&(h.set(W,U),W.update())})(R),R.isRenderTargetTexture===!1&&R.version>0&&K.__version!==R.version){let W=R.image;if(W===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else{if(W.complete!==!1)return void $(K,R,w);console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete")}}t.bindTexture(i.TEXTURE_2D,K.__webglTexture,i.TEXTURE0+w)}let X={[qa]:i.REPEAT,[tr]:i.CLAMP_TO_EDGE,[d0]:i.MIRRORED_REPEAT},N={[hi]:i.NEAREST,[gu]:i.NEAREST_MIPMAP_NEAREST,[Mc]:i.NEAREST_MIPMAP_LINEAR,[_n]:i.LINEAR,[ym]:i.LINEAR_MIPMAP_NEAREST,[al]:i.LINEAR_MIPMAP_LINEAR},oe={512:i.NEVER,519:i.ALWAYS,513:i.LESS,515:i.LEQUAL,514:i.EQUAL,518:i.GEQUAL,516:i.GREATER,517:i.NOTEQUAL};function F(R,w,K){if(K?(i.texParameteri(R,i.TEXTURE_WRAP_S,X[w.wrapS]),i.texParameteri(R,i.TEXTURE_WRAP_T,X[w.wrapT]),R!==i.TEXTURE_3D&&R!==i.TEXTURE_2D_ARRAY||i.texParameteri(R,i.TEXTURE_WRAP_R,X[w.wrapR]),i.texParameteri(R,i.TEXTURE_MAG_FILTER,N[w.magFilter]),i.texParameteri(R,i.TEXTURE_MIN_FILTER,N[w.minFilter])):(i.texParameteri(R,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(R,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),R!==i.TEXTURE_3D&&R!==i.TEXTURE_2D_ARRAY||i.texParameteri(R,i.TEXTURE_WRAP_R,i.CLAMP_TO_EDGE),w.wrapS===tr&&w.wrapT===tr||console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),i.texParameteri(R,i.TEXTURE_MAG_FILTER,S(w.magFilter)),i.texParameteri(R,i.TEXTURE_MIN_FILTER,S(w.minFilter)),w.minFilter!==hi&&w.minFilter!==_n&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),w.compareFunction&&(i.texParameteri(R,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(R,i.TEXTURE_COMPARE_FUNC,oe[w.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){let W=e.get("EXT_texture_filter_anisotropic");if(w.magFilter===hi||w.minFilter!==Mc&&w.minFilter!==al||w.type===ir&&e.has("OES_texture_float_linear")===!1||o===!1&&w.type===qi&&e.has("OES_texture_half_float_linear")===!1)return;(w.anisotropy>1||n.get(w).__currentAnisotropy)&&(i.texParameterf(R,W.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(w.anisotropy,r.getMaxAnisotropy())),n.get(w).__currentAnisotropy=w.anisotropy)}}function ne(R,w){let K=!1;R.__webglInit===void 0&&(R.__webglInit=!0,w.addEventListener("dispose",T));let W=w.source,U=u.get(W);U===void 0&&(U={},u.set(W,U));let re=(function(k){let H=[];return H.push(k.wrapS),H.push(k.wrapT),H.push(k.wrapR||0),H.push(k.magFilter),H.push(k.minFilter),H.push(k.anisotropy),H.push(k.internalFormat),H.push(k.format),H.push(k.type),H.push(k.generateMipmaps),H.push(k.premultiplyAlpha),H.push(k.flipY),H.push(k.unpackAlignment),H.push(k.colorSpace),H.join()})(w);if(re!==R.__cacheKey){U[re]===void 0&&(U[re]={texture:i.createTexture(),usedTimes:0},s.memory.textures++,K=!0),U[re].usedTimes++;let k=U[R.__cacheKey];k!==void 0&&(U[R.__cacheKey].usedTimes--,k.usedTimes===0&&L(w)),R.__cacheKey=re,R.__webglTexture=U[re].texture}return K}function $(R,w,K){let W=i.TEXTURE_2D;(w.isDataArrayTexture||w.isCompressedArrayTexture)&&(W=i.TEXTURE_2D_ARRAY),w.isData3DTexture&&(W=i.TEXTURE_3D);let U=ne(R,w),re=w.source;t.bindTexture(W,R.__webglTexture,i.TEXTURE0+K);let k=n.get(re);if(re.version!==k.__version||U===!0){t.activeTexture(i.TEXTURE0+K);let H=Rt.getPrimaries(Rt.workingColorSpace),ie=w.colorSpace===In?null:Rt.getPrimaries(w.colorSpace),ge=w.colorSpace===In||H===ie?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,w.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,w.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ge);let pe=(function(Te){return!o&&(Te.wrapS!==tr||Te.wrapT!==tr||Te.minFilter!==hi&&Te.minFilter!==_n)})(w)&&f(w.image)===!1,b=g(w.image,pe,!1,r.maxTextureSize);b=Ce(w,b);let Q=f(b)||o,G=a.convert(w.format,w.colorSpace),Y,ce=a.convert(w.type),xe=v(w.internalFormat,G,ce,w.colorSpace,w.isVideoTexture);F(W,w,Q);let we=w.mipmaps,_e=o&&w.isVideoTexture!==!0&&xe!==pp,Ae=k.__version===void 0||U===!0,be=E(w,b,Q);if(w.isDepthTexture)xe=i.DEPTH_COMPONENT,o?xe=w.type===ir?i.DEPTH_COMPONENT32F:w.type===ur?i.DEPTH_COMPONENT24:w.type===Wr?i.DEPTH24_STENCIL8:i.DEPTH_COMPONENT16:w.type===ir&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),w.format===jr&&xe===i.DEPTH_COMPONENT&&w.type!==ch&&w.type!==ur&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),w.type=ur,ce=a.convert(w.type)),w.format===Ya&&xe===i.DEPTH_COMPONENT&&(xe=i.DEPTH_STENCIL,w.type!==Wr&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),w.type=Wr,ce=a.convert(w.type))),Ae&&(_e?t.texStorage2D(i.TEXTURE_2D,1,xe,b.width,b.height):t.texImage2D(i.TEXTURE_2D,0,xe,b.width,b.height,0,G,ce,null));else if(w.isDataTexture)if(we.length>0&&Q){_e&&Ae&&t.texStorage2D(i.TEXTURE_2D,be,xe,we[0].width,we[0].height);for(let Te=0,Ie=we.length;Te<Ie;Te++)Y=we[Te],_e?t.texSubImage2D(i.TEXTURE_2D,Te,0,0,Y.width,Y.height,G,ce,Y.data):t.texImage2D(i.TEXTURE_2D,Te,xe,Y.width,Y.height,0,G,ce,Y.data);w.generateMipmaps=!1}else _e?(Ae&&t.texStorage2D(i.TEXTURE_2D,be,xe,b.width,b.height),t.texSubImage2D(i.TEXTURE_2D,0,0,0,b.width,b.height,G,ce,b.data)):t.texImage2D(i.TEXTURE_2D,0,xe,b.width,b.height,0,G,ce,b.data);else if(w.isCompressedTexture)if(w.isCompressedArrayTexture){_e&&Ae&&t.texStorage3D(i.TEXTURE_2D_ARRAY,be,xe,we[0].width,we[0].height,b.depth);for(let Te=0,Ie=we.length;Te<Ie;Te++)Y=we[Te],w.format!==Mn?G!==null?_e?t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Te,0,0,0,Y.width,Y.height,b.depth,G,Y.data,0,0):t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,Te,xe,Y.width,Y.height,b.depth,0,Y.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):_e?t.texSubImage3D(i.TEXTURE_2D_ARRAY,Te,0,0,0,Y.width,Y.height,b.depth,G,ce,Y.data):t.texImage3D(i.TEXTURE_2D_ARRAY,Te,xe,Y.width,Y.height,b.depth,0,G,ce,Y.data)}else{_e&&Ae&&t.texStorage2D(i.TEXTURE_2D,be,xe,we[0].width,we[0].height);for(let Te=0,Ie=we.length;Te<Ie;Te++)Y=we[Te],w.format!==Mn?G!==null?_e?t.compressedTexSubImage2D(i.TEXTURE_2D,Te,0,0,Y.width,Y.height,G,Y.data):t.compressedTexImage2D(i.TEXTURE_2D,Te,xe,Y.width,Y.height,0,Y.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):_e?t.texSubImage2D(i.TEXTURE_2D,Te,0,0,Y.width,Y.height,G,ce,Y.data):t.texImage2D(i.TEXTURE_2D,Te,xe,Y.width,Y.height,0,G,ce,Y.data)}else if(w.isDataArrayTexture)_e?(Ae&&t.texStorage3D(i.TEXTURE_2D_ARRAY,be,xe,b.width,b.height,b.depth),t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,b.width,b.height,b.depth,G,ce,b.data)):t.texImage3D(i.TEXTURE_2D_ARRAY,0,xe,b.width,b.height,b.depth,0,G,ce,b.data);else if(w.isData3DTexture)_e?(Ae&&t.texStorage3D(i.TEXTURE_3D,be,xe,b.width,b.height,b.depth),t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,b.width,b.height,b.depth,G,ce,b.data)):t.texImage3D(i.TEXTURE_3D,0,xe,b.width,b.height,b.depth,0,G,ce,b.data);else if(w.isFramebufferTexture){if(Ae)if(_e)t.texStorage2D(i.TEXTURE_2D,be,xe,b.width,b.height);else{let Te=b.width,Ie=b.height;for(let ee=0;ee<be;ee++)t.texImage2D(i.TEXTURE_2D,ee,xe,Te,Ie,0,G,ce,null),Te>>=1,Ie>>=1}}else if(we.length>0&&Q){_e&&Ae&&t.texStorage2D(i.TEXTURE_2D,be,xe,we[0].width,we[0].height);for(let Te=0,Ie=we.length;Te<Ie;Te++)Y=we[Te],_e?t.texSubImage2D(i.TEXTURE_2D,Te,0,0,G,ce,Y):t.texImage2D(i.TEXTURE_2D,Te,xe,G,ce,Y);w.generateMipmaps=!1}else _e?(Ae&&t.texStorage2D(i.TEXTURE_2D,be,xe,b.width,b.height),t.texSubImage2D(i.TEXTURE_2D,0,0,0,G,ce,b)):t.texImage2D(i.TEXTURE_2D,0,xe,G,ce,b);y(w,Q)&&x(W),k.__version=re.version,w.onUpdate&&w.onUpdate(w)}R.__version=w.version}function O(R,w,K,W,U,re){let k=a.convert(K.format,K.colorSpace),H=a.convert(K.type),ie=v(K.internalFormat,k,H,K.colorSpace);if(!n.get(w).__hasExternalTextures){let ge=Math.max(1,w.width>>re),pe=Math.max(1,w.height>>re);U===i.TEXTURE_3D||U===i.TEXTURE_2D_ARRAY?t.texImage3D(U,re,ie,ge,pe,w.depth,0,k,H,null):t.texImage2D(U,re,ie,ge,pe,0,k,H,null)}t.bindFramebuffer(i.FRAMEBUFFER,R),te(w)?l.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,W,U,n.get(K).__webglTexture,0,Z(w)):(U===i.TEXTURE_2D||U>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&U<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,W,U,n.get(K).__webglTexture,re),t.bindFramebuffer(i.FRAMEBUFFER,null)}function q(R,w,K){if(i.bindRenderbuffer(i.RENDERBUFFER,R),w.depthBuffer&&!w.stencilBuffer){let W=o===!0?i.DEPTH_COMPONENT24:i.DEPTH_COMPONENT16;if(K||te(w)){let U=w.depthTexture;U&&U.isDepthTexture&&(U.type===ir?W=i.DEPTH_COMPONENT32F:U.type===ur&&(W=i.DEPTH_COMPONENT24));let re=Z(w);te(w)?l.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,re,W,w.width,w.height):i.renderbufferStorageMultisample(i.RENDERBUFFER,re,W,w.width,w.height)}else i.renderbufferStorage(i.RENDERBUFFER,W,w.width,w.height);i.framebufferRenderbuffer(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.RENDERBUFFER,R)}else if(w.depthBuffer&&w.stencilBuffer){let W=Z(w);K&&te(w)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,W,i.DEPTH24_STENCIL8,w.width,w.height):te(w)?l.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,W,i.DEPTH24_STENCIL8,w.width,w.height):i.renderbufferStorage(i.RENDERBUFFER,i.DEPTH_STENCIL,w.width,w.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.RENDERBUFFER,R)}else{let W=w.isWebGLMultipleRenderTargets===!0?w.texture:[w.texture];for(let U=0;U<W.length;U++){let re=W[U],k=a.convert(re.format,re.colorSpace),H=a.convert(re.type),ie=v(re.internalFormat,k,H,re.colorSpace),ge=Z(w);K&&te(w)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,ge,ie,w.width,w.height):te(w)?l.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ge,ie,w.width,w.height):i.renderbufferStorage(i.RENDERBUFFER,ie,w.width,w.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function se(R){let w=n.get(R),K=R.isWebGLCubeRenderTarget===!0;if(R.depthTexture&&!w.__autoAllocateDepthBuffer){if(K)throw new Error("target.depthTexture not supported in Cube render targets");(function(W,U){if(U&&U.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,W),!U.depthTexture||!U.depthTexture.isDepthTexture)throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");n.get(U.depthTexture).__webglTexture&&U.depthTexture.image.width===U.width&&U.depthTexture.image.height===U.height||(U.depthTexture.image.width=U.width,U.depthTexture.image.height=U.height,U.depthTexture.needsUpdate=!0),V(U.depthTexture,0);let re=n.get(U.depthTexture).__webglTexture,k=Z(U);if(U.depthTexture.format===jr)te(U)?l.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,re,0,k):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,re,0);else{if(U.depthTexture.format!==Ya)throw new Error("Unknown depthTexture format");te(U)?l.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,re,0,k):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,re,0)}})(w.__webglFramebuffer,R)}else if(K){w.__webglDepthbuffer=[];for(let W=0;W<6;W++)t.bindFramebuffer(i.FRAMEBUFFER,w.__webglFramebuffer[W]),w.__webglDepthbuffer[W]=i.createRenderbuffer(),q(w.__webglDepthbuffer[W],R,!1)}else t.bindFramebuffer(i.FRAMEBUFFER,w.__webglFramebuffer),w.__webglDepthbuffer=i.createRenderbuffer(),q(w.__webglDepthbuffer,R,!1);t.bindFramebuffer(i.FRAMEBUFFER,null)}function Z(R){return Math.min(r.maxSamples,R.samples)}function te(R){let w=n.get(R);return o&&R.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&w.__useRenderToTexture!==!1}function Ce(R,w){let K=R.colorSpace,W=R.format,U=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||R.format===f0||K!==nr&&K!==In&&(Rt.getTransfer(K)===Ut?o===!1?e.has("EXT_sRGB")===!0&&W===Mn?(R.format=f0,R.minFilter=_n,R.generateMipmaps=!1):w=fl.sRGBToLinear(w):W===Mn&&U===Vr||console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",K)),w}this.allocateTextureUnit=function(){let R=I;return R>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+r.maxTextures),I+=1,R},this.resetTextureUnits=function(){I=0},this.setTexture2D=V,this.setTexture2DArray=function(R,w){let K=n.get(R);R.version>0&&K.__version!==R.version?$(K,R,w):t.bindTexture(i.TEXTURE_2D_ARRAY,K.__webglTexture,i.TEXTURE0+w)},this.setTexture3D=function(R,w){let K=n.get(R);R.version>0&&K.__version!==R.version?$(K,R,w):t.bindTexture(i.TEXTURE_3D,K.__webglTexture,i.TEXTURE0+w)},this.setTextureCube=function(R,w){let K=n.get(R);R.version>0&&K.__version!==R.version?(function(W,U,re){if(U.image.length!==6)return;let k=ne(W,U),H=U.source;t.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture,i.TEXTURE0+re);let ie=n.get(H);if(H.version!==ie.__version||k===!0){t.activeTexture(i.TEXTURE0+re);let ge=Rt.getPrimaries(Rt.workingColorSpace),pe=U.colorSpace===In?null:Rt.getPrimaries(U.colorSpace),b=U.colorSpace===In||ge===pe?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,U.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,U.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,b);let Q=U.isCompressedTexture||U.image[0].isCompressedTexture,G=U.image[0]&&U.image[0].isDataTexture,Y=[];for(let le=0;le<6;le++)Y[le]=Q||G?G?U.image[le].image:U.image[le]:g(U.image[le],!1,!0,r.maxCubemapSize),Y[le]=Ce(U,Y[le]);let ce=Y[0],xe=f(ce)||o,we=a.convert(U.format,U.colorSpace),_e=a.convert(U.type),Ae=v(U.internalFormat,we,_e,U.colorSpace),be=o&&U.isVideoTexture!==!0,Te=ie.__version===void 0||k===!0,Ie,ee=E(U,ce,xe);if(F(i.TEXTURE_CUBE_MAP,U,xe),Q){be&&Te&&t.texStorage2D(i.TEXTURE_CUBE_MAP,ee,Ae,ce.width,ce.height);for(let le=0;le<6;le++){Ie=Y[le].mipmaps;for(let ue=0;ue<Ie.length;ue++){let Me=Ie[ue];U.format!==Mn?we!==null?be?t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue,0,0,Me.width,Me.height,we,Me.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue,Ae,Me.width,Me.height,0,Me.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):be?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue,0,0,Me.width,Me.height,we,_e,Me.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue,Ae,Me.width,Me.height,0,we,_e,Me.data)}}}else{Ie=U.mipmaps,be&&Te&&(Ie.length>0&&ee++,t.texStorage2D(i.TEXTURE_CUBE_MAP,ee,Ae,Y[0].width,Y[0].height));for(let le=0;le<6;le++)if(G){be?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,0,0,0,Y[le].width,Y[le].height,we,_e,Y[le].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,0,Ae,Y[le].width,Y[le].height,0,we,_e,Y[le].data);for(let ue=0;ue<Ie.length;ue++){let Me=Ie[ue].image[le].image;be?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue+1,0,0,Me.width,Me.height,we,_e,Me.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue+1,Ae,Me.width,Me.height,0,we,_e,Me.data)}}else{be?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,0,0,0,we,_e,Y[le]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,0,Ae,we,_e,Y[le]);for(let ue=0;ue<Ie.length;ue++){let Me=Ie[ue];be?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue+1,0,0,we,_e,Me.image[le]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+le,ue+1,Ae,we,_e,Me.image[le])}}}y(U,xe)&&x(i.TEXTURE_CUBE_MAP),ie.__version=H.version,U.onUpdate&&U.onUpdate(U)}W.__version=U.version})(K,R,w):t.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture,i.TEXTURE0+w)},this.rebindTextures=function(R,w,K){let W=n.get(R);w!==void 0&&O(W.__webglFramebuffer,R,R.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),K!==void 0&&se(R)},this.setupRenderTarget=function(R){let w=R.texture,K=n.get(R),W=n.get(w);R.addEventListener("dispose",C),R.isWebGLMultipleRenderTargets!==!0&&(W.__webglTexture===void 0&&(W.__webglTexture=i.createTexture()),W.__version=w.version,s.memory.textures++);let U=R.isWebGLCubeRenderTarget===!0,re=R.isWebGLMultipleRenderTargets===!0,k=f(R)||o;if(U){K.__webglFramebuffer=[];for(let H=0;H<6;H++)if(o&&w.mipmaps&&w.mipmaps.length>0){K.__webglFramebuffer[H]=[];for(let ie=0;ie<w.mipmaps.length;ie++)K.__webglFramebuffer[H][ie]=i.createFramebuffer()}else K.__webglFramebuffer[H]=i.createFramebuffer()}else{if(o&&w.mipmaps&&w.mipmaps.length>0){K.__webglFramebuffer=[];for(let H=0;H<w.mipmaps.length;H++)K.__webglFramebuffer[H]=i.createFramebuffer()}else K.__webglFramebuffer=i.createFramebuffer();if(re)if(r.drawBuffers){let H=R.texture;for(let ie=0,ge=H.length;ie<ge;ie++){let pe=n.get(H[ie]);pe.__webglTexture===void 0&&(pe.__webglTexture=i.createTexture(),s.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&R.samples>0&&te(R)===!1){let H=re?w:[w];K.__webglMultisampledFramebuffer=i.createFramebuffer(),K.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,K.__webglMultisampledFramebuffer);for(let ie=0;ie<H.length;ie++){let ge=H[ie];K.__webglColorRenderbuffer[ie]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,K.__webglColorRenderbuffer[ie]);let pe=a.convert(ge.format,ge.colorSpace),b=a.convert(ge.type),Q=v(ge.internalFormat,pe,b,ge.colorSpace,R.isXRRenderTarget===!0),G=Z(R);i.renderbufferStorageMultisample(i.RENDERBUFFER,G,Q,R.width,R.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ie,i.RENDERBUFFER,K.__webglColorRenderbuffer[ie])}i.bindRenderbuffer(i.RENDERBUFFER,null),R.depthBuffer&&(K.__webglDepthRenderbuffer=i.createRenderbuffer(),q(K.__webglDepthRenderbuffer,R,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(U){t.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture),F(i.TEXTURE_CUBE_MAP,w,k);for(let H=0;H<6;H++)if(o&&w.mipmaps&&w.mipmaps.length>0)for(let ie=0;ie<w.mipmaps.length;ie++)O(K.__webglFramebuffer[H][ie],R,w,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+H,ie);else O(K.__webglFramebuffer[H],R,w,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+H,0);y(w,k)&&x(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(re){let H=R.texture;for(let ie=0,ge=H.length;ie<ge;ie++){let pe=H[ie],b=n.get(pe);t.bindTexture(i.TEXTURE_2D,b.__webglTexture),F(i.TEXTURE_2D,pe,k),O(K.__webglFramebuffer,R,pe,i.COLOR_ATTACHMENT0+ie,i.TEXTURE_2D,0),y(pe,k)&&x(i.TEXTURE_2D)}t.unbindTexture()}else{let H=i.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(o?H=R.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),t.bindTexture(H,W.__webglTexture),F(H,w,k),o&&w.mipmaps&&w.mipmaps.length>0)for(let ie=0;ie<w.mipmaps.length;ie++)O(K.__webglFramebuffer[ie],R,w,i.COLOR_ATTACHMENT0,H,ie);else O(K.__webglFramebuffer,R,w,i.COLOR_ATTACHMENT0,H,0);y(w,k)&&x(H),t.unbindTexture()}R.depthBuffer&&se(R)},this.updateRenderTargetMipmap=function(R){let w=f(R)||o,K=R.isWebGLMultipleRenderTargets===!0?R.texture:[R.texture];for(let W=0,U=K.length;W<U;W++){let re=K[W];if(y(re,w)){let k=R.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:i.TEXTURE_2D,H=n.get(re).__webglTexture;t.bindTexture(k,H),x(k),t.unbindTexture()}}},this.updateMultisampleRenderTarget=function(R){if(o&&R.samples>0&&te(R)===!1){let w=R.isWebGLMultipleRenderTargets?R.texture:[R.texture],K=R.width,W=R.height,U=i.COLOR_BUFFER_BIT,re=[],k=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,H=n.get(R),ie=R.isWebGLMultipleRenderTargets===!0;if(ie)for(let ge=0;ge<w.length;ge++)t.bindFramebuffer(i.FRAMEBUFFER,H.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ge,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,H.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ge,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,H.__webglMultisampledFramebuffer),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,H.__webglFramebuffer);for(let ge=0;ge<w.length;ge++){re.push(i.COLOR_ATTACHMENT0+ge),R.depthBuffer&&re.push(k);let pe=H.__ignoreDepthValues!==void 0&&H.__ignoreDepthValues;if(pe===!1&&(R.depthBuffer&&(U|=i.DEPTH_BUFFER_BIT),R.stencilBuffer&&(U|=i.STENCIL_BUFFER_BIT)),ie&&i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,H.__webglColorRenderbuffer[ge]),pe===!0&&(i.invalidateFramebuffer(i.READ_FRAMEBUFFER,[k]),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[k])),ie){let b=n.get(w[ge]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,b,0)}i.blitFramebuffer(0,0,K,W,0,0,K,W,U,i.NEAREST),c&&i.invalidateFramebuffer(i.READ_FRAMEBUFFER,re)}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ie)for(let ge=0;ge<w.length;ge++){t.bindFramebuffer(i.FRAMEBUFFER,H.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ge,i.RENDERBUFFER,H.__webglColorRenderbuffer[ge]);let pe=n.get(w[ge]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,H.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ge,i.TEXTURE_2D,pe,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,H.__webglMultisampledFramebuffer)}},this.setupDepthRenderbuffer=se,this.setupFrameBufferTexture=O,this.useMultisampledRTT=te}function o1(i,e,t){let n=t.isWebGL2;return{convert:function(r,a=""){let s,o=Rt.getTransfer(a);if(r===Vr)return i.UNSIGNED_BYTE;if(r===lp)return i.UNSIGNED_SHORT_4_4_4_4;if(r===cp)return i.UNSIGNED_SHORT_5_5_5_1;if(r===1010)return i.BYTE;if(r===1011)return i.SHORT;if(r===ch)return i.UNSIGNED_SHORT;if(r===op)return i.INT;if(r===ur)return i.UNSIGNED_INT;if(r===ir)return i.FLOAT;if(r===qi)return n?i.HALF_FLOAT:(s=e.get("OES_texture_half_float"),s!==null?s.HALF_FLOAT_OES:null);if(r===1021)return i.ALPHA;if(r===Mn)return i.RGBA;if(r===1024)return i.LUMINANCE;if(r===1025)return i.LUMINANCE_ALPHA;if(r===jr)return i.DEPTH_COMPONENT;if(r===Ya)return i.DEPTH_STENCIL;if(r===f0)return s=e.get("EXT_sRGB"),s!==null?s.SRGB_ALPHA_EXT:null;if(r===1028)return i.RED;if(r===hp)return i.RED_INTEGER;if(r===1030)return i.RG;if(r===up)return i.RG_INTEGER;if(r===dp)return i.RGBA_INTEGER;if(r===Sc||r===Tc||r===Ec||r===wc)if(o===Ut){if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s===null)return null;if(r===Sc)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(r===Tc)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(r===Ec)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(r===wc)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else{if(s=e.get("WEBGL_compressed_texture_s3tc"),s===null)return null;if(r===Sc)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(r===Tc)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(r===Ec)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(r===wc)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}if(r===vu||r===xu||r===yu||r===bu){if(s=e.get("WEBGL_compressed_texture_pvrtc"),s===null)return null;if(r===vu)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(r===xu)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(r===yu)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(r===bu)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}if(r===pp)return s=e.get("WEBGL_compressed_texture_etc1"),s!==null?s.COMPRESSED_RGB_ETC1_WEBGL:null;if(r===_u||r===Mu){if(s=e.get("WEBGL_compressed_texture_etc"),s===null)return null;if(r===_u)return o===Ut?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(r===Mu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}if(r===Su||r===Tu||r===Eu||r===wu||r===Au||r===Ru||r===Cu||r===Pu||r===Lu||r===Iu||r===Du||r===Uu||r===ku||r===Nu){if(s=e.get("WEBGL_compressed_texture_astc"),s===null)return null;if(r===Su)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(r===Tu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(r===Eu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(r===wu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(r===Au)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(r===Ru)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(r===Cu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(r===Pu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(r===Lu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(r===Iu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(r===Du)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(r===Uu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(r===ku)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(r===Nu)return o===Ut?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}if(r===Ac||r===Bu||r===Ou){if(s=e.get("EXT_texture_compression_bptc"),s===null)return null;if(r===Ac)return o===Ut?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(r===Bu)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(r===Ou)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}if(r===36283||r===zu||r===Hu||r===Fu){if(s=e.get("EXT_texture_compression_rgtc"),s===null)return null;if(r===Ac)return s.COMPRESSED_RED_RGTC1_EXT;if(r===zu)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(r===Hu)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(r===Fu)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}return r===Wr?n?i.UNSIGNED_INT_24_8:(s=e.get("WEBGL_depth_texture"),s!==null?s.UNSIGNED_INT_24_8_WEBGL:null):i[r]!==void 0?i[r]:null}}}function c1(i,e){function t(r,a){r.matrixAutoUpdate===!0&&r.updateMatrix(),a.value.copy(r.matrix)}function n(r,a){r.opacity.value=a.opacity,a.color&&r.diffuse.value.copy(a.color),a.emissive&&r.emissive.value.copy(a.emissive).multiplyScalar(a.emissiveIntensity),a.map&&(r.map.value=a.map,t(a.map,r.mapTransform)),a.alphaMap&&(r.alphaMap.value=a.alphaMap,t(a.alphaMap,r.alphaMapTransform)),a.bumpMap&&(r.bumpMap.value=a.bumpMap,t(a.bumpMap,r.bumpMapTransform),r.bumpScale.value=a.bumpScale,a.side===di&&(r.bumpScale.value*=-1)),a.normalMap&&(r.normalMap.value=a.normalMap,t(a.normalMap,r.normalMapTransform),r.normalScale.value.copy(a.normalScale),a.side===di&&r.normalScale.value.negate()),a.displacementMap&&(r.displacementMap.value=a.displacementMap,t(a.displacementMap,r.displacementMapTransform),r.displacementScale.value=a.displacementScale,r.displacementBias.value=a.displacementBias),a.emissiveMap&&(r.emissiveMap.value=a.emissiveMap,t(a.emissiveMap,r.emissiveMapTransform)),a.specularMap&&(r.specularMap.value=a.specularMap,t(a.specularMap,r.specularMapTransform)),a.alphaTest>0&&(r.alphaTest.value=a.alphaTest);let s=e.get(a).envMap;if(s&&(r.envMap.value=s,r.flipEnvMap.value=s.isCubeTexture&&s.isRenderTargetTexture===!1?-1:1,r.reflectivity.value=a.reflectivity,r.ior.value=a.ior,r.refractionRatio.value=a.refractionRatio),a.lightMap){r.lightMap.value=a.lightMap;let o=i._useLegacyLights===!0?Math.PI:1;r.lightMapIntensity.value=a.lightMapIntensity*o,t(a.lightMap,r.lightMapTransform)}a.aoMap&&(r.aoMap.value=a.aoMap,r.aoMapIntensity.value=a.aoMapIntensity,t(a.aoMap,r.aoMapTransform))}return{refreshFogUniforms:function(r,a){a.color.getRGB(r.fogColor.value,vp(i)),a.isFog?(r.fogNear.value=a.near,r.fogFar.value=a.far):a.isFogExp2&&(r.fogDensity.value=a.density)},refreshMaterialUniforms:function(r,a,s,o,l){a.isMeshBasicMaterial||a.isMeshLambertMaterial?n(r,a):a.isMeshToonMaterial?(n(r,a),(function(c,h){h.gradientMap&&(c.gradientMap.value=h.gradientMap)})(r,a)):a.isMeshPhongMaterial?(n(r,a),(function(c,h){c.specular.value.copy(h.specular),c.shininess.value=Math.max(h.shininess,1e-4)})(r,a)):a.isMeshStandardMaterial?(n(r,a),(function(c,h){c.metalness.value=h.metalness,h.metalnessMap&&(c.metalnessMap.value=h.metalnessMap,t(h.metalnessMap,c.metalnessMapTransform)),c.roughness.value=h.roughness,h.roughnessMap&&(c.roughnessMap.value=h.roughnessMap,t(h.roughnessMap,c.roughnessMapTransform)),e.get(h).envMap&&(c.envMapIntensity.value=h.envMapIntensity)})(r,a),a.isMeshPhysicalMaterial&&(function(c,h,d){c.ior.value=h.ior,h.sheen>0&&(c.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),c.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(c.sheenColorMap.value=h.sheenColorMap,t(h.sheenColorMap,c.sheenColorMapTransform)),h.sheenRoughnessMap&&(c.sheenRoughnessMap.value=h.sheenRoughnessMap,t(h.sheenRoughnessMap,c.sheenRoughnessMapTransform))),h.clearcoat>0&&(c.clearcoat.value=h.clearcoat,c.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(c.clearcoatMap.value=h.clearcoatMap,t(h.clearcoatMap,c.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(c.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,t(h.clearcoatRoughnessMap,c.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(c.clearcoatNormalMap.value=h.clearcoatNormalMap,t(h.clearcoatNormalMap,c.clearcoatNormalMapTransform),c.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===di&&c.clearcoatNormalScale.value.negate())),h.iridescence>0&&(c.iridescence.value=h.iridescence,c.iridescenceIOR.value=h.iridescenceIOR,c.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],c.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(c.iridescenceMap.value=h.iridescenceMap,t(h.iridescenceMap,c.iridescenceMapTransform)),h.iridescenceThicknessMap&&(c.iridescenceThicknessMap.value=h.iridescenceThicknessMap,t(h.iridescenceThicknessMap,c.iridescenceThicknessMapTransform))),h.transmission>0&&(c.transmission.value=h.transmission,c.transmissionSamplerMap.value=d.texture,c.transmissionSamplerSize.value.set(d.width,d.height),h.transmissionMap&&(c.transmissionMap.value=h.transmissionMap,t(h.transmissionMap,c.transmissionMapTransform)),c.thickness.value=h.thickness,h.thicknessMap&&(c.thicknessMap.value=h.thicknessMap,t(h.thicknessMap,c.thicknessMapTransform)),c.attenuationDistance.value=h.attenuationDistance,c.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(c.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(c.anisotropyMap.value=h.anisotropyMap,t(h.anisotropyMap,c.anisotropyMapTransform))),c.specularIntensity.value=h.specularIntensity,c.specularColor.value.copy(h.specularColor),h.specularColorMap&&(c.specularColorMap.value=h.specularColorMap,t(h.specularColorMap,c.specularColorMapTransform)),h.specularIntensityMap&&(c.specularIntensityMap.value=h.specularIntensityMap,t(h.specularIntensityMap,c.specularIntensityMapTransform))})(r,a,l)):a.isMeshMatcapMaterial?(n(r,a),(function(c,h){h.matcap&&(c.matcap.value=h.matcap)})(r,a)):a.isMeshDepthMaterial?n(r,a):a.isMeshDistanceMaterial?(n(r,a),(function(c,h){let d=e.get(h).light;c.referencePosition.value.setFromMatrixPosition(d.matrixWorld),c.nearDistance.value=d.shadow.camera.near,c.farDistance.value=d.shadow.camera.far})(r,a)):a.isMeshNormalMaterial?n(r,a):a.isLineBasicMaterial?((function(c,h){c.diffuse.value.copy(h.color),c.opacity.value=h.opacity,h.map&&(c.map.value=h.map,t(h.map,c.mapTransform))})(r,a),a.isLineDashedMaterial&&(function(c,h){c.dashSize.value=h.dashSize,c.totalSize.value=h.dashSize+h.gapSize,c.scale.value=h.scale})(r,a)):a.isPointsMaterial?(function(c,h,d,u){c.diffuse.value.copy(h.color),c.opacity.value=h.opacity,c.size.value=h.size*d,c.scale.value=.5*u,h.map&&(c.map.value=h.map,t(h.map,c.uvTransform)),h.alphaMap&&(c.alphaMap.value=h.alphaMap,t(h.alphaMap,c.alphaMapTransform)),h.alphaTest>0&&(c.alphaTest.value=h.alphaTest)})(r,a,s,o):a.isSpriteMaterial?(function(c,h){c.diffuse.value.copy(h.color),c.opacity.value=h.opacity,c.rotation.value=h.rotation,h.map&&(c.map.value=h.map,t(h.map,c.mapTransform)),h.alphaMap&&(c.alphaMap.value=h.alphaMap,t(h.alphaMap,c.alphaMapTransform)),h.alphaTest>0&&(c.alphaTest.value=h.alphaTest)})(r,a):a.isShadowMaterial?(r.color.value.copy(a.color),r.opacity.value=a.opacity):a.isShaderMaterial&&(a.uniformsNeedUpdate=!1)}}}function h1(i,e,t,n){let r={},a={},s=[],o=t.isWebGL2?i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS):0;function l(d,u,p,m){let g=d.value,f=u+"_"+p;if(m[f]===void 0)return m[f]=typeof g=="number"||typeof g=="boolean"?g:g.clone(),!0;{let y=m[f];if(typeof g=="number"||typeof g=="boolean"){if(y!==g)return m[f]=g,!0}else if(y.equals(g)===!1)return y.copy(g),!0}return!1}function c(d){let u={boundary:0,storage:0};return typeof d=="number"||typeof d=="boolean"?(u.boundary=4,u.storage=4):d.isVector2?(u.boundary=8,u.storage=8):d.isVector3||d.isColor?(u.boundary=16,u.storage=12):d.isVector4?(u.boundary=16,u.storage=16):d.isMatrix3?(u.boundary=48,u.storage=48):d.isMatrix4?(u.boundary=64,u.storage=64):d.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",d),u}function h(d){let u=d.target;u.removeEventListener("dispose",h);let p=s.indexOf(u.__bindingPointIndex);s.splice(p,1),i.deleteBuffer(r[u.id]),delete r[u.id],delete a[u.id]}return{bind:function(d,u){let p=u.program;n.uniformBlockBinding(d,p)},update:function(d,u){let p=r[d.id];p===void 0&&((function(f){let y=f.uniforms,x=0,v=16;for(let S=0,T=y.length;S<T;S++){let C=Array.isArray(y[S])?y[S]:[y[S]];for(let L=0,I=C.length;L<I;L++){let V=C[L],X=Array.isArray(V.value)?V.value:[V.value];for(let N=0,oe=X.length;N<oe;N++){let F=c(X[N]),ne=x%v;ne!==0&&v-ne<F.boundary&&(x+=v-ne),V.__data=new Float32Array(F.storage/Float32Array.BYTES_PER_ELEMENT),V.__offset=x,x+=F.storage}}}let E=x%v;E>0&&(x+=v-E),f.__size=x,f.__cache={}})(d),p=(function(f){let y=(function(){for(let S=0;S<o;S++)if(s.indexOf(S)===-1)return s.push(S),S;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0})();f.__bindingPointIndex=y;let x=i.createBuffer(),v=f.__size,E=f.usage;return i.bindBuffer(i.UNIFORM_BUFFER,x),i.bufferData(i.UNIFORM_BUFFER,v,E),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,y,x),x})(d),r[d.id]=p,d.addEventListener("dispose",h));let m=u.program;n.updateUBOMapping(d,m);let g=e.render.frame;a[d.id]!==g&&((function(f){let y=r[f.id],x=f.uniforms,v=f.__cache;i.bindBuffer(i.UNIFORM_BUFFER,y);for(let E=0,S=x.length;E<S;E++){let T=Array.isArray(x[E])?x[E]:[x[E]];for(let C=0,L=T.length;C<L;C++){let I=T[C];if(l(I,E,C,v)===!0){let V=I.__offset,X=Array.isArray(I.value)?I.value:[I.value],N=0;for(let oe=0;oe<X.length;oe++){let F=X[oe],ne=c(F);typeof F=="number"||typeof F=="boolean"?(I.__data[0]=F,i.bufferSubData(i.UNIFORM_BUFFER,V+N,I.__data)):F.isMatrix3?(I.__data[0]=F.elements[0],I.__data[1]=F.elements[1],I.__data[2]=F.elements[2],I.__data[3]=0,I.__data[4]=F.elements[3],I.__data[5]=F.elements[4],I.__data[6]=F.elements[5],I.__data[7]=0,I.__data[8]=F.elements[6],I.__data[9]=F.elements[7],I.__data[10]=F.elements[8],I.__data[11]=0):(F.toArray(I.__data,N),N+=ne.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,V,I.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)})(d),a[d.id]=g)},dispose:function(){for(let d in r)i.deleteBuffer(r[d]);s=[],r={},a={}}}}function Xo(i,e,t,n,r,a){za.subVectors(i,t).addScalar(.5).multiply(n),r!==void 0?(Ps.x=a*za.x-r*za.y,Ps.y=r*za.x+a*za.y):Ps.copy(za),i.copy(e),i.x+=Ps.x,i.y+=Ps.y,i.applyMatrix4(Tp)}function Xd(i,e,t,n,r,a,s){let o=D0.distanceSqToPoint(i);if(o<t){let l=new D;D0.closestPointToPoint(i,l),l.applyMatrix4(n);let c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;a.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,object:s})}}function fh(){let i=0,e=0,t=0,n=0;function r(a,s,o,l){i=a,e=o,t=-3*a+3*s-2*o-l,n=2*a-2*s+o+l}return{initCatmullRom:function(a,s,o,l,c){r(s,o,c*(o-a),c*(l-s))},initNonuniformCatmullRom:function(a,s,o,l,c,h,d){let u=(s-a)/c-(o-a)/(c+h)+(o-s)/h,p=(o-s)/h-(l-s)/(h+d)+(l-o)/d;u*=h,p*=h,r(s,o,u,p)},calc:function(a){let s=a*a;return i+e*a+t*s+n*(s*a)}}}function qd(i,e,t,n,r){let a=.5*(n-e),s=.5*(r-t),o=i*i;return(2*t-2*n+a+s)*(i*o)+(-3*t+3*n-2*a-s)*o+a*i+t}function Os(i,e,t,n){return(function(r,a){let s=1-r;return s*s*a})(i,e)+(function(r,a){return 2*(1-r)*r*a})(i,t)+(function(r,a){return r*r*a})(i,n)}function zs(i,e,t,n,r){return(function(a,s){let o=1-a;return o*o*o*s})(i,e)+(function(a,s){let o=1-a;return 3*o*o*a*s})(i,t)+(function(a,s){return 3*(1-a)*a*a*s})(i,n)+(function(a,s){return a*a*a*s})(i,r)}function Yd(i,e,t,n,r){let a,s;if(r===(function(o,l,c,h){let d=0;for(let u=l,p=c-h;u<c;u+=h)d+=(o[p]-o[u])*(o[u+1]+o[p+1]),p=u;return d})(i,e,t,n)>0)for(a=e;a<t;a+=n)s=Zd(a,i[a],i[a+1],s);else for(a=t-n;a>=e;a-=n)s=Zd(a,i[a],i[a+1],s);return s&&Ol(s,s.next)&&(to(s),s=s.next),s}function ea(i,e){if(!i)return i;e||(e=i);let t,n=i;do if(t=!1,n.steiner||!Ol(n,n.next)&&Gt(n.prev,n,n.next)!==0)n=n.next;else{if(to(n),n=e=n.prev,n===n.next)break;t=!0}while(t||n!==e);return e}function Qs(i,e,t,n,r,a,s){if(!i)return;!s&&a&&(function(h,d,u,p){let m=h;do m.z===0&&(m.z=z0(m.x,m.y,d,u,p)),m.prevZ=m.prev,m.nextZ=m.next,m=m.next;while(m!==h);m.prevZ.nextZ=null,m.prevZ=null,(function(g){let f,y,x,v,E,S,T,C,L=1;do{for(y=g,g=null,E=null,S=0;y;){for(S++,x=y,T=0,f=0;f<L&&(T++,x=x.nextZ,x);f++);for(C=L;T>0||C>0&&x;)T!==0&&(C===0||!x||y.z<=x.z)?(v=y,y=y.nextZ,T--):(v=x,x=x.nextZ,C--),E?E.nextZ=v:g=v,v.prevZ=E,E=v;y=x}E.nextZ=null,L*=2}while(S>1)})(m)})(i,n,r,a);let o,l,c=i;for(;i.prev!==i.next;)if(o=i.prev,l=i.next,a?g1(i,n,r,a):m1(i))e.push(o.i/t|0),e.push(i.i/t|0),e.push(l.i/t|0),to(i),i=l.next,c=l.next;else if((i=l)===c){s?s===1?Qs(i=v1(ea(i),e,t),e,t,n,r,a,2):s===2&&x1(i,e,t,n,r,a):Qs(ea(i),e,t,n,r,a,1);break}}function m1(i){let e=i.prev,t=i,n=i.next;if(Gt(e,t,n)>=0)return!1;let r=e.x,a=t.x,s=n.x,o=e.y,l=t.y,c=n.y,h=r<a?r<s?r:s:a<s?a:s,d=o<l?o<c?o:c:l<c?l:c,u=r>a?r>s?r:s:a>s?a:s,p=o>l?o>c?o:c:l>c?l:c,m=n.next;for(;m!==e;){if(m.x>=h&&m.x<=u&&m.y>=d&&m.y<=p&&Fa(r,o,a,l,s,c,m.x,m.y)&&Gt(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function g1(i,e,t,n){let r=i.prev,a=i,s=i.next;if(Gt(r,a,s)>=0)return!1;let o=r.x,l=a.x,c=s.x,h=r.y,d=a.y,u=s.y,p=o<l?o<c?o:c:l<c?l:c,m=h<d?h<u?h:u:d<u?d:u,g=o>l?o>c?o:c:l>c?l:c,f=h>d?h>u?h:u:d>u?d:u,y=z0(p,m,e,t,n),x=z0(g,f,e,t,n),v=i.prevZ,E=i.nextZ;for(;v&&v.z>=y&&E&&E.z<=x;){if(v.x>=p&&v.x<=g&&v.y>=m&&v.y<=f&&v!==r&&v!==s&&Fa(o,h,l,d,c,u,v.x,v.y)&&Gt(v.prev,v,v.next)>=0||(v=v.prevZ,E.x>=p&&E.x<=g&&E.y>=m&&E.y<=f&&E!==r&&E!==s&&Fa(o,h,l,d,c,u,E.x,E.y)&&Gt(E.prev,E,E.next)>=0))return!1;E=E.nextZ}for(;v&&v.z>=y;){if(v.x>=p&&v.x<=g&&v.y>=m&&v.y<=f&&v!==r&&v!==s&&Fa(o,h,l,d,c,u,v.x,v.y)&&Gt(v.prev,v,v.next)>=0)return!1;v=v.prevZ}for(;E&&E.z<=x;){if(E.x>=p&&E.x<=g&&E.y>=m&&E.y<=f&&E!==r&&E!==s&&Fa(o,h,l,d,c,u,E.x,E.y)&&Gt(E.prev,E,E.next)>=0)return!1;E=E.nextZ}return!0}function v1(i,e,t){let n=i;do{let r=n.prev,a=n.next.next;!Ol(r,a)&&Ep(r,n,n.next,a)&&eo(r,a)&&eo(a,r)&&(e.push(r.i/t|0),e.push(n.i/t|0),e.push(a.i/t|0),to(n),to(n.next),n=i=a),n=n.next}while(n!==i);return ea(n)}function x1(i,e,t,n,r,a){let s=i;do{let o=s.next.next;for(;o!==s.prev;){if(s.i!==o.i&&S1(s,o)){let l=wp(s,o);return s=ea(s,s.next),l=ea(l,l.next),Qs(s,e,t,n,r,a,0),void Qs(l,e,t,n,r,a,0)}o=o.next}s=s.next}while(s!==i)}function y1(i,e){return i.x-e.x}function b1(i,e){let t=(function(r,a){let s,o=a,l=-1/0,c=r.x,h=r.y;do{if(h<=o.y&&h>=o.next.y&&o.next.y!==o.y){let f=o.x+(h-o.y)*(o.next.x-o.x)/(o.next.y-o.y);if(f<=c&&f>l&&(l=f,s=o.x<o.next.x?o:o.next,f===c))return s}o=o.next}while(o!==a);if(!s)return null;let d=s,u=s.x,p=s.y,m,g=1/0;o=s;do c>=o.x&&o.x>=u&&c!==o.x&&Fa(h<p?c:l,h,u,p,h<p?l:c,h,o.x,o.y)&&(m=Math.abs(h-o.y)/(c-o.x),eo(o,r)&&(m<g||m===g&&(o.x>s.x||o.x===s.x&&_1(s,o)))&&(s=o,g=m)),o=o.next;while(o!==d);return s})(i,e);if(!t)return e;let n=wp(t,i);return ea(n,n.next),ea(t,t.next)}function _1(i,e){return Gt(i.prev,i,e.prev)<0&&Gt(e.next,i,i.next)<0}function z0(i,e,t,n,r){return(i=1431655765&((i=858993459&((i=252645135&((i=16711935&((i=(i-t)*r|0)|i<<8))|i<<4))|i<<2))|i<<1))|(e=1431655765&((e=858993459&((e=252645135&((e=16711935&((e=(e-n)*r|0)|e<<8))|e<<4))|e<<2))|e<<1))<<1}function M1(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function Fa(i,e,t,n,r,a,s,o){return(r-s)*(e-o)>=(i-s)*(a-o)&&(i-s)*(n-o)>=(t-s)*(e-o)&&(t-s)*(a-o)>=(r-s)*(n-o)}function S1(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!(function(t,n){let r=t;do{if(r.i!==t.i&&r.next.i!==t.i&&r.i!==n.i&&r.next.i!==n.i&&Ep(r,r.next,t,n))return!0;r=r.next}while(r!==t);return!1})(i,e)&&(eo(i,e)&&eo(e,i)&&(function(t,n){let r=t,a=!1,s=(t.x+n.x)/2,o=(t.y+n.y)/2;do r.y>o!=r.next.y>o&&r.next.y!==r.y&&s<(r.next.x-r.x)*(o-r.y)/(r.next.y-r.y)+r.x&&(a=!a),r=r.next;while(r!==t);return a})(i,e)&&(Gt(i.prev,i,e.prev)||Gt(i,e.prev,e))||Ol(i,e)&&Gt(i.prev,i,i.next)>0&&Gt(e.prev,e,e.next)>0)}function Gt(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function Ol(i,e){return i.x===e.x&&i.y===e.y}function Ep(i,e,t,n){let r=nl(Gt(i,e,t)),a=nl(Gt(i,e,n)),s=nl(Gt(t,n,i)),o=nl(Gt(t,n,e));return r!==a&&s!==o||!(r!==0||!il(i,t,e))||!(a!==0||!il(i,n,e))||!(s!==0||!il(t,i,n))||!(o!==0||!il(t,e,n))}function il(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function nl(i){return i>0?1:i<0?-1:0}function eo(i,e){return Gt(i.prev,i,i.next)<0?Gt(i,e,i.next)>=0&&Gt(i,i.prev,e)>=0:Gt(i,e,i.prev)<0||Gt(i,i.next,e)<0}function wp(i,e){let t=new H0(i.i,i.x,i.y),n=new H0(e.i,e.x,e.y),r=i.next,a=e.prev;return i.next=e,e.prev=i,t.next=r,r.prev=t,n.next=t,t.prev=n,a.next=n,n.prev=a,n}function Zd(i,e,t,n){let r=new H0(i,e,t);return n?(r.next=n.next,r.prev=n,n.next.prev=r,n.next=r):(r.prev=r,r.next=r),r}function to(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function H0(i,e,t){this.i=i,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Jd(i){let e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function Kd(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}function $d(i,e,t){let n=`${i.x},${i.y},${i.z}-${e.x},${e.y},${e.z}`,r=`${e.x},${e.y},${e.z}-${i.x},${i.y},${i.z}`;return t.has(n)!==!0&&t.has(r)!==!0&&(t.add(n),t.add(r),!0)}function rl(i,e,t){return!i||!t&&i.constructor===e?i:typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i)}function E1(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function ip(){return(typeof performance>"u"?Date:performance).now()}var np,rh,Qn,ni,di,Vt,rp,ln,Hr,l0,c0,ap,mm,gm,pr,ah,sh,oh,no,vm,lh,mu,xm,sp,ja,Xa,h0,u0,kl,qa,tr,d0,hi,gu,Mc,_n,ym,al,Vr,ch,op,ur,ir,qi,lp,cp,Wr,Mn,jr,Ya,hh,hp,up,dp,Sc,Tc,Ec,wc,vu,xu,yu,bu,pp,_u,Mu,Su,Tu,Eu,wu,Au,Ru,Cu,Pu,Lu,Iu,Du,Uu,ku,Nu,Ac,Bu,Ou,zu,Hu,Fu,sl,ol,Rc,Gu,Vu,Wu,fp,Xr,In,$t,nr,uh,Nl,ll,Ut,cl,hl,ba,p0,ju,f0,Za,ul,mr,Ti,Xu,Ga,Ja,dh,Re,dt,Cc,qu,Yu,Zu,Mo,_m,Rt,_a,fl,Mm,ml,Sm,Xi,pt,v0,_i,gl,x0,Xt,D,Ic,Ju,nn,Yn,xn,So,Ma,Sa,Ta,sr,or,kr,Ts,To,Eo,Nr,Tm,Es,Uc,rn,Zn,kc,wo,lr,Nc,Ao,Bc,Ka,Ze,Ea,yn,Em,wm,cr,Ro,Wi,Ku,$u,$a,vl,Am,Qu,wa,Jn,Co,ws,Rm,Cm,ed,td,id,Pm,Lm,vt,bn,Kn,Oc,$n,Aa,Ra,nd,zc,Hc,Fc,Po,dr,gp,hr,Lo,ke,Ei,Im,Un,Pt,yx,ii,Io,jt,rr,xl,He,Um,tn,Vc,Ca,ji,As,ci,ut,rd,Br,Do,ad,Pa,La,Ia,Wc,Uo,ko,No,Bo,sd,od,ld,Oo,zo,yt,Xe,xr,qt,Fs,bi,Da,y0,yl,b0,jc,km,Nm,er,Or,Fo,es,pi,ot,Be,Ln,Go,gr,cd,Rs,Xc,hd,qc,Yc,Zc,zr,Ua,ud,bl,_l,yp,bp,_p,Mp,Sp,md,gd,vd,xd,yd,_0,M0,S0,Jc,Wa,Og,zg,Gg,Vg,jg,Yg,E0,w0,e1,A0,R0,C0,ht,l1,Bs,P0,Gs,L0,Ml,Vs,Sl,Ci,Ws,an,Na,Cs,Ba,Oa,za,Ps,Tp,Wo,Ls,jo,Pd,Kc,Ld,En,bx,_x,Id,Dd,Ud,u1,kd,qo,$c,Nd,Qc,vr,ts,qr,Bd,d1,js,Xs,Ha,Od,Yo,zd,p1,Is,Ds,Yr,I0,Mx,Sx,Tx,Ex,wx,Ax,Rx,Cx,Px,Lx,Zr,Hd,Fd,Gd,e0,Zo,is,Vd,Wd,Tl,qs,jd,D0,Jo,Ko,Ys,Jr,sn,Zs,U0,$o,t0,i0,n0,wi,El,k0,wl,N0,Al,Rl,Cl,Pl,B0,Js,Ks,Kr,$r,Ke,Qt,Qr,$s,Qo,el,r0,tl,O0,ns,f1,fr,ri,T1,ta,rs,F0,G0,bt,V0,wt,W0,wn,j0,Ix,Ll,on,as,X0,q0,Y0,Tn,Fr,Z0,J0,K0,Hs,Gr,$0,Q0,w1,eh,ss,Il,a0,Qd,ep,io,th,os,tp,Us,s0,ih,ia,nh,Dl,Dx,Ux,kx,Ul,Nx,Bx,Ox,zx,Hx,Fx,Gx,Vx,mh,A1,o0,R1,C1,P1,Ft,Wx,jx,Xx,qx,Yx,Zx,Jx,Kx,$x,Qx,ey,ty,iy,ny,ry,ay,sy,oy,kn=ki(()=>{np=1,rh=2,Qn=3,ni=0,di=1,Vt=2,rp=0,ln=2,Hr=100,l0=204,c0=205,ap=0,mm=1,gm=2,pr=0,ah=1,sh=2,oh=3,no=4,vm=5,lh=6,mu="attached",xm="detached",sp=300,ja=301,Xa=302,h0=303,u0=304,kl=306,qa=1e3,tr=1001,d0=1002,hi=1003,gu=1004,Mc=1005,_n=1006,ym=1007,al=1008,Vr=1009,ch=1012,op=1013,ur=1014,ir=1015,qi=1016,lp=1017,cp=1018,Wr=1020,Mn=1023,jr=1026,Ya=1027,hh=1028,hp=1029,up=1031,dp=1033,Sc=33776,Tc=33777,Ec=33778,wc=33779,vu=35840,xu=35841,yu=35842,bu=35843,pp=36196,_u=37492,Mu=37496,Su=37808,Tu=37809,Eu=37810,wu=37811,Au=37812,Ru=37813,Cu=37814,Pu=37815,Lu=37816,Iu=37817,Du=37818,Uu=37819,ku=37820,Nu=37821,Ac=36492,Bu=36494,Ou=36495,zu=36284,Hu=36285,Fu=36286,sl=2300,ol=2301,Rc=2302,Gu=2400,Vu=2401,Wu=2402,fp=3e3,Xr=3001,In="",$t="srgb",nr="srgb-linear",uh="display-p3",Nl="display-p3-linear",ll="linear",Ut="srgb",cl="rec709",hl="p3",ba=7680,p0=35044,ju="300 es",f0=1035,Za=2e3,ul=2001,mr=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let n=this._listeners[e];if(n!==void 0){let r=n.indexOf(t);r!==-1&&n.splice(r,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let t=this._listeners[e.type];if(t!==void 0){e.target=this;let n=t.slice(0);for(let r=0,a=n.length;r<a;r++)n[r].call(this,e);e.target=null}}},Ti=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Xu=1234567,Ga=Math.PI/180,Ja=180/Math.PI;dh={DEG2RAD:Ga,RAD2DEG:Ja,generateUUID:Sn,clamp:ui,euclideanModulo:m0,mapLinear:function(i,e,t,n,r){return n+(i-e)*(r-n)/(t-e)},inverseLerp:function(i,e,t){return i!==e?(t-i)/(e-i):0},lerp:ks,damp:function(i,e,t,n){return ks(i,e,1-Math.exp(-t*n))},pingpong:function(i,e=1){return e-Math.abs(m0(i,2*e)-e)},smoothstep:function(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e))*i*(3-2*i)},smootherstep:function(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e))*i*i*(i*(6*i-15)+10)},randInt:function(i,e){return i+Math.floor(Math.random()*(e-i+1))},randFloat:function(i,e){return i+Math.random()*(e-i)},randFloatSpread:function(i){return i*(.5-Math.random())},seededRandom:function(i){i!==void 0&&(Xu=i);let e=Xu+=1831565813;return e=Math.imul(e^e>>>15,1|e),e^=e+Math.imul(e^e>>>7,61|e),((e^e>>>14)>>>0)/4294967296},degToRad:function(i){return i*Ga},radToDeg:function(i){return i*Ja},isPowerOfTwo:g0,ceilPowerOfTwo:function(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))},floorPowerOfTwo:dl,setQuaternionFromProperEuler:function(i,e,t,n,r){let a=Math.cos,s=Math.sin,o=a(t/2),l=s(t/2),c=a((e+n)/2),h=s((e+n)/2),d=a((e-n)/2),u=s((e-n)/2),p=a((n-e)/2),m=s((n-e)/2);switch(r){case"XYX":i.set(o*h,l*d,l*u,o*c);break;case"YZY":i.set(l*u,o*h,l*d,o*c);break;case"ZXZ":i.set(l*d,l*u,o*h,o*c);break;case"XZX":i.set(o*h,l*m,l*p,o*c);break;case"YXY":i.set(l*p,o*h,l*m,o*c);break;case"ZYZ":i.set(l*m,l*p,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}},normalize:It,denormalize:Dn},Re=class i{constructor(e=0,t=0){i.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(ui(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),a=this.x-e.x,s=this.y-e.y;return this.x=a*n-s*r+e.x,this.y=a*r+s*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},dt=class i{constructor(e,t,n,r,a,s,o,l,c){i.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,a,s,o,l,c)}set(e,t,n,r,a,s,o,l,c){let h=this.elements;return h[0]=e,h[1]=r,h[2]=o,h[3]=t,h[4]=a,h[5]=l,h[6]=n,h[7]=s,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,a=this.elements,s=n[0],o=n[3],l=n[6],c=n[1],h=n[4],d=n[7],u=n[2],p=n[5],m=n[8],g=r[0],f=r[3],y=r[6],x=r[1],v=r[4],E=r[7],S=r[2],T=r[5],C=r[8];return a[0]=s*g+o*x+l*S,a[3]=s*f+o*v+l*T,a[6]=s*y+o*E+l*C,a[1]=c*g+h*x+d*S,a[4]=c*f+h*v+d*T,a[7]=c*y+h*E+d*C,a[2]=u*g+p*x+m*S,a[5]=u*f+p*v+m*T,a[8]=u*y+p*E+m*C,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],a=e[3],s=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*s*h-t*o*c-n*a*h+n*o*l+r*a*c-r*s*l}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],a=e[3],s=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=h*s-o*c,u=o*l-h*a,p=c*a-s*l,m=t*d+n*u+r*p;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let g=1/m;return e[0]=d*g,e[1]=(r*c-h*n)*g,e[2]=(o*n-r*s)*g,e[3]=u*g,e[4]=(h*t-r*l)*g,e[5]=(r*a-o*t)*g,e[6]=p*g,e[7]=(n*l-c*t)*g,e[8]=(s*t-n*a)*g,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,a,s,o){let l=Math.cos(a),c=Math.sin(a);return this.set(n*l,n*c,-n*(l*s+c*o)+s+e,-r*c,r*l,-r*(-c*s+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(Cc.makeScale(e,t)),this}rotate(e){return this.premultiply(Cc.makeRotation(-e)),this}translate(e,t){return this.premultiply(Cc.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<9;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Cc=new dt;qu={};Yu=new dt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),Zu=new dt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),Mo={[nr]:{transfer:ll,primaries:cl,toReference:i=>i,fromReference:i=>i},[$t]:{transfer:Ut,primaries:cl,toReference:i=>i.convertSRGBToLinear(),fromReference:i=>i.convertLinearToSRGB()},[Nl]:{transfer:ll,primaries:hl,toReference:i=>i.applyMatrix3(Zu),fromReference:i=>i.applyMatrix3(Yu)},[uh]:{transfer:Ut,primaries:hl,toReference:i=>i.convertSRGBToLinear().applyMatrix3(Zu),fromReference:i=>i.applyMatrix3(Yu).convertLinearToSRGB()}},_m=new Set([nr,Nl]),Rt={enabled:!0,_workingColorSpace:nr,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(i){if(!_m.has(i))throw new Error(`Unsupported working color space, "${i}".`);this._workingColorSpace=i},convert:function(i,e,t){if(this.enabled===!1||e===t||!e||!t)return i;let n=Mo[e].toReference;return(0,Mo[t].fromReference)(n(i))},fromWorkingColorSpace:function(i,e){return this.convert(i,this._workingColorSpace,e)},toWorkingColorSpace:function(i,e){return this.convert(i,e,this._workingColorSpace)},getPrimaries:function(i){return Mo[i].primaries},getTransfer:function(i){return i===In?ll:Mo[i].transfer}};fl=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{_a===void 0&&(_a=pl("canvas")),_a.width=e.width,_a.height=e.height;let n=_a.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=_a}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=pl("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),a=r.data;for(let s=0;s<a.length;s++)a[s]=255*Va(a[s]/255);return n.putImageData(r,0,0),t}if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(255*Va(t[n]/255)):t[n]=Va(t[n]);return{data:t,width:e.width,height:e.height}}return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Mm=0,ml=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Mm++}),this.uuid=Sn(),this.data=e,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},r=this.data;if(r!==null){let a;if(Array.isArray(r)){a=[];for(let s=0,o=r.length;s<o;s++)r[s].isDataTexture?a.push(Lc(r[s].image)):a.push(Lc(r[s]))}else a=Lc(r);n.url=a}return t||(e.images[this.uuid]=n),n}};Sm=0,Xi=class i extends mr{constructor(e=i.DEFAULT_IMAGE,t=i.DEFAULT_MAPPING,n=1001,r=1001,a=1006,s=1008,o=1023,l=1009,c=i.DEFAULT_ANISOTROPY,h=""){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Sm++}),this.uuid=Sn(),this.name="",this.source=new ml(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=r,this.magFilter=a,this.minFilter=s,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Re(0,0),this.repeat=new Re(1,1),this.center=new Re(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new dt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof h=="string"?this.colorSpace=h:(Ns("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=h===Xr?$t:In),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==sp)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case qa:e.x=e.x-Math.floor(e.x);break;case tr:e.x=e.x<0?0:1;break;case d0:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x)}if(e.y<0||e.y>1)switch(this.wrapT){case qa:e.y=e.y-Math.floor(e.y);break;case tr:e.y=e.y<0?0:1;break;case d0:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y)}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return Ns("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===$t?Xr:fp}set encoding(e){Ns("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=e===Xr?$t:In}};Xi.DEFAULT_IMAGE=null,Xi.DEFAULT_MAPPING=sp,Xi.DEFAULT_ANISOTROPY=1;pt=class i{constructor(e=0,t=0,n=0,r=1){i.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,a=this.w,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*r+s[12]*a,this.y=s[1]*t+s[5]*n+s[9]*r+s[13]*a,this.z=s[2]*t+s[6]*n+s[10]*r+s[14]*a,this.w=s[3]*t+s[7]*n+s[11]*r+s[15]*a,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,a,l=e.elements,c=l[0],h=l[4],d=l[8],u=l[1],p=l[5],m=l[9],g=l[2],f=l[6],y=l[10];if(Math.abs(h-u)<.01&&Math.abs(d-g)<.01&&Math.abs(m-f)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+g)<.1&&Math.abs(m+f)<.1&&Math.abs(c+p+y-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let v=(c+1)/2,E=(p+1)/2,S=(y+1)/2,T=(h+u)/4,C=(d+g)/4,L=(m+f)/4;return v>E&&v>S?v<.01?(n=0,r=.707106781,a=.707106781):(n=Math.sqrt(v),r=T/n,a=C/n):E>S?E<.01?(n=.707106781,r=0,a=.707106781):(r=Math.sqrt(E),n=T/r,a=L/r):S<.01?(n=.707106781,r=.707106781,a=0):(a=Math.sqrt(S),n=C/a,r=L/a),this.set(n,r,a,t),this}let x=Math.sqrt((f-m)*(f-m)+(d-g)*(d-g)+(u-h)*(u-h));return Math.abs(x)<.001&&(x=1),this.x=(f-m)/x,this.y=(d-g)/x,this.z=(u-h)/x,this.w=Math.acos((c+p+y-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},v0=class extends mr{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new pt(0,0,e,t),this.scissorTest=!1,this.viewport=new pt(0,0,e,t);let r={width:e,height:t,depth:1};n.encoding!==void 0&&(Ns("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===Xr?$t:In),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:_n,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new Xi(r,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(e,t,n=1){this.width===e&&this.height===t&&this.depth===n||(this.width=e,this.height=t,this.depth=n,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.texture.isRenderTargetTexture=!0;let t=Object.assign({},e.texture.image);return this.texture.source=new ml(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},_i=class extends v0{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},gl=class extends Xi{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=hi,this.minFilter=hi,this.wrapR=tr,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},x0=class extends Xi{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=hi,this.minFilter=hi,this.wrapR=tr,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Xt=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,a,s,o){let l=n[r+0],c=n[r+1],h=n[r+2],d=n[r+3],u=a[s+0],p=a[s+1],m=a[s+2],g=a[s+3];if(o===0)return e[t+0]=l,e[t+1]=c,e[t+2]=h,void(e[t+3]=d);if(o===1)return e[t+0]=u,e[t+1]=p,e[t+2]=m,void(e[t+3]=g);if(d!==g||l!==u||c!==p||h!==m){let f=1-o,y=l*u+c*p+h*m+d*g,x=y>=0?1:-1,v=1-y*y;if(v>Number.EPSILON){let S=Math.sqrt(v),T=Math.atan2(S,y*x);f=Math.sin(f*T)/S,o=Math.sin(o*T)/S}let E=o*x;if(l=l*f+u*E,c=c*f+p*E,h=h*f+m*E,d=d*f+g*E,f===1-o){let S=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=S,c*=S,h*=S,d*=S}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,r,a,s){let o=n[r],l=n[r+1],c=n[r+2],h=n[r+3],d=a[s],u=a[s+1],p=a[s+2],m=a[s+3];return e[t]=o*m+h*d+l*p-c*u,e[t+1]=l*m+h*u+c*d-o*p,e[t+2]=c*m+h*p+o*u-l*d,e[t+3]=h*m-o*d-l*u-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,a=e._z,s=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(r/2),d=o(a/2),u=l(n/2),p=l(r/2),m=l(a/2);switch(s){case"XYZ":this._x=u*h*d+c*p*m,this._y=c*p*d-u*h*m,this._z=c*h*m+u*p*d,this._w=c*h*d-u*p*m;break;case"YXZ":this._x=u*h*d+c*p*m,this._y=c*p*d-u*h*m,this._z=c*h*m-u*p*d,this._w=c*h*d+u*p*m;break;case"ZXY":this._x=u*h*d-c*p*m,this._y=c*p*d+u*h*m,this._z=c*h*m+u*p*d,this._w=c*h*d-u*p*m;break;case"ZYX":this._x=u*h*d-c*p*m,this._y=c*p*d+u*h*m,this._z=c*h*m-u*p*d,this._w=c*h*d+u*p*m;break;case"YZX":this._x=u*h*d+c*p*m,this._y=c*p*d+u*h*m,this._z=c*h*m-u*p*d,this._w=c*h*d-u*p*m;break;case"XZY":this._x=u*h*d-c*p*m,this._y=c*p*d-u*h*m,this._z=c*h*m+u*p*d,this._w=c*h*d+u*p*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+s)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],a=t[8],s=t[1],o=t[5],l=t[9],c=t[2],h=t[6],d=t[10],u=n+o+d;if(u>0){let p=.5/Math.sqrt(u+1);this._w=.25/p,this._x=(h-l)*p,this._y=(a-c)*p,this._z=(s-r)*p}else if(n>o&&n>d){let p=2*Math.sqrt(1+n-o-d);this._w=(h-l)/p,this._x=.25*p,this._y=(r+s)/p,this._z=(a+c)/p}else if(o>d){let p=2*Math.sqrt(1+o-n-d);this._w=(a-c)/p,this._x=(r+s)/p,this._y=.25*p,this._z=(l+h)/p}else{let p=2*Math.sqrt(1+d-n-o);this._w=(s-r)/p,this._x=(a+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(ui(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,a=e._z,s=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+s*o+r*c-a*l,this._y=r*h+s*l+a*o-n*c,this._z=a*h+s*c+n*l-r*o,this._w=s*h-n*o-r*l-a*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let n=this._x,r=this._y,a=this._z,s=this._w,o=s*e._w+n*e._x+r*e._y+a*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=s,this._x=n,this._y=r,this._z=a,this;let l=1-o*o;if(l<=Number.EPSILON){let p=1-t;return this._w=p*s+t*this._w,this._x=p*n+t*this._x,this._y=p*r+t*this._y,this._z=p*a+t*this._z,this.normalize(),this}let c=Math.sqrt(l),h=Math.atan2(c,o),d=Math.sin((1-t)*h)/c,u=Math.sin(t*h)/c;return this._w=s*d+this._w*u,this._x=n*d+this._x*u,this._y=r*d+this._y*u,this._z=a*d+this._z*u,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=Math.random(),t=Math.sqrt(1-e),n=Math.sqrt(e),r=2*Math.PI*Math.random(),a=2*Math.PI*Math.random();return this.set(t*Math.cos(r),n*Math.sin(a),n*Math.cos(a),t*Math.sin(r))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},D=class i{constructor(e=0,t=0,n=0){i.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Ju.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Ju.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,a=e.elements;return this.x=a[0]*t+a[3]*n+a[6]*r,this.y=a[1]*t+a[4]*n+a[7]*r,this.z=a[2]*t+a[5]*n+a[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,a=e.elements,s=1/(a[3]*t+a[7]*n+a[11]*r+a[15]);return this.x=(a[0]*t+a[4]*n+a[8]*r+a[12])*s,this.y=(a[1]*t+a[5]*n+a[9]*r+a[13])*s,this.z=(a[2]*t+a[6]*n+a[10]*r+a[14])*s,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,a=e.x,s=e.y,o=e.z,l=e.w,c=2*(s*r-o*n),h=2*(o*t-a*r),d=2*(a*n-s*t);return this.x=t+l*c+s*d-o*h,this.y=n+l*h+o*c-a*d,this.z=r+l*d+a*h-s*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r,this.y=a[1]*t+a[5]*n+a[9]*r,this.z=a[2]*t+a[6]*n+a[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,a=e.z,s=t.x,o=t.y,l=t.z;return this.x=r*l-a*o,this.y=a*s-n*l,this.z=n*o-r*s,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Ic.copy(this).projectOnVector(e),this.sub(Ic)}reflect(e){return this.sub(Ic.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(ui(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,4*t)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,3*t)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=2*(Math.random()-.5),t=Math.random()*Math.PI*2,n=Math.sqrt(1-e**2);return this.x=n*Math.cos(t),this.y=n*Math.sin(t),this.z=e,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Ic=new D,Ju=new Xt,nn=class{constructor(e=new D(1/0,1/0,1/0),t=new D(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(xn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(xn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=xn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let a=n.getAttribute("position");if(t===!0&&a!==void 0&&e.isInstancedMesh!==!0)for(let s=0,o=a.count;s<o;s++)e.isMesh===!0?e.getVertexPosition(s,xn):xn.fromBufferAttribute(a,s),xn.applyMatrix4(e.matrixWorld),this.expandByPoint(xn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),So.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),So.copy(n.boundingBox)),So.applyMatrix4(e.matrixWorld),this.union(So)}let r=e.children;for(let a=0,s=r.length;a<s;a++)this.expandByObject(r[a],t);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,xn),xn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ts),To.subVectors(this.max,Ts),Ma.subVectors(e.a,Ts),Sa.subVectors(e.b,Ts),Ta.subVectors(e.c,Ts),sr.subVectors(Sa,Ma),or.subVectors(Ta,Sa),kr.subVectors(Ma,Ta);let t=[0,-sr.z,sr.y,0,-or.z,or.y,0,-kr.z,kr.y,sr.z,0,-sr.x,or.z,0,-or.x,kr.z,0,-kr.x,-sr.y,sr.x,0,-or.y,or.x,0,-kr.y,kr.x,0];return!!Dc(t,Ma,Sa,Ta,To)&&(t=[1,0,0,0,1,0,0,0,1],!!Dc(t,Ma,Sa,Ta,To)&&(Eo.crossVectors(sr,or),t=[Eo.x,Eo.y,Eo.z],Dc(t,Ma,Sa,Ta,To)))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,xn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=.5*this.getSize(xn).length()),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()||(Yn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Yn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Yn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Yn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Yn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Yn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Yn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Yn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Yn)),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}},Yn=[new D,new D,new D,new D,new D,new D,new D,new D],xn=new D,So=new nn,Ma=new D,Sa=new D,Ta=new D,sr=new D,or=new D,kr=new D,Ts=new D,To=new D,Eo=new D,Nr=new D;Tm=new nn,Es=new D,Uc=new D,rn=class{constructor(e=new D,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):Tm.setFromPoints(e).getCenter(n);let r=0;for(let a=0,s=e.length;a<s;a++)r=Math.max(r,n.distanceToSquared(e[a]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Es.subVectors(e,this.center);let t=Es.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),r=.5*(n-this.radius);this.center.addScaledVector(Es,r/n),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Uc.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Es.copy(e.center).add(Uc)),this.expandByPoint(Es.copy(e.center).sub(Uc))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}},Zn=new D,kc=new D,wo=new D,lr=new D,Nc=new D,Ao=new D,Bc=new D,Ka=class{constructor(e=new D,t=new D(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Zn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Zn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Zn.copy(this.origin).addScaledVector(this.direction,t),Zn.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){kc.copy(e).add(t).multiplyScalar(.5),wo.copy(t).sub(e).normalize(),lr.copy(this.origin).sub(kc);let a=.5*e.distanceTo(t),s=-this.direction.dot(wo),o=lr.dot(this.direction),l=-lr.dot(wo),c=lr.lengthSq(),h=Math.abs(1-s*s),d,u,p,m;if(h>0)if(d=s*l-o,u=s*o-l,m=a*h,d>=0)if(u>=-m)if(u<=m){let g=1/h;d*=g,u*=g,p=d*(d+s*u+2*o)+u*(s*d+u+2*l)+c}else u=a,d=Math.max(0,-(s*u+o)),p=-d*d+u*(u+2*l)+c;else u=-a,d=Math.max(0,-(s*u+o)),p=-d*d+u*(u+2*l)+c;else u<=-m?(d=Math.max(0,-(-s*a+o)),u=d>0?-a:Math.min(Math.max(-a,-l),a),p=-d*d+u*(u+2*l)+c):u<=m?(d=0,u=Math.min(Math.max(-a,-l),a),p=u*(u+2*l)+c):(d=Math.max(0,-(s*a+o)),u=d>0?a:Math.min(Math.max(-a,-l),a),p=-d*d+u*(u+2*l)+c);else u=s>0?-a:a,d=Math.max(0,-(s*u+o)),p=-d*d+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),r&&r.copy(kc).addScaledVector(wo,u),p}intersectSphere(e,t){Zn.subVectors(e.center,this.origin);let n=Zn.dot(this.direction),r=Zn.dot(Zn)-n*n,a=e.radius*e.radius;if(r>a)return null;let s=Math.sqrt(a-r),o=n-s,l=n+s;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0?!0:e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,a,s,o,l,c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return c>=0?(n=(e.min.x-u.x)*c,r=(e.max.x-u.x)*c):(n=(e.max.x-u.x)*c,r=(e.min.x-u.x)*c),h>=0?(a=(e.min.y-u.y)*h,s=(e.max.y-u.y)*h):(a=(e.max.y-u.y)*h,s=(e.min.y-u.y)*h),n>s||a>r?null:((a>n||isNaN(n))&&(n=a),(s<r||isNaN(r))&&(r=s),d>=0?(o=(e.min.z-u.z)*d,l=(e.max.z-u.z)*d):(o=(e.max.z-u.z)*d,l=(e.min.z-u.z)*d),n>l||o>r?null:((o>n||n!=n)&&(n=o),(l<r||r!=r)&&(r=l),r<0?null:this.at(n>=0?n:r,t)))}intersectsBox(e){return this.intersectBox(e,Zn)!==null}intersectTriangle(e,t,n,r,a){Nc.subVectors(t,e),Ao.subVectors(n,e),Bc.crossVectors(Nc,Ao);let s,o=this.direction.dot(Bc);if(o>0){if(r)return null;s=1}else{if(!(o<0))return null;s=-1,o=-o}lr.subVectors(this.origin,e);let l=s*this.direction.dot(Ao.crossVectors(lr,Ao));if(l<0)return null;let c=s*this.direction.dot(Nc.cross(lr));if(c<0||l+c>o)return null;let h=-s*lr.dot(Bc);return h<0?null:this.at(h/o,a)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Ze=class i{constructor(e,t,n,r,a,s,o,l,c,h,d,u,p,m,g,f){i.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,a,s,o,l,c,h,d,u,p,m,g,f)}set(e,t,n,r,a,s,o,l,c,h,d,u,p,m,g,f){let y=this.elements;return y[0]=e,y[4]=t,y[8]=n,y[12]=r,y[1]=a,y[5]=s,y[9]=o,y[13]=l,y[2]=c,y[6]=h,y[10]=d,y[14]=u,y[3]=p,y[7]=m,y[11]=g,y[15]=f,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,n=e.elements,r=1/Ea.setFromMatrixColumn(e,0).length(),a=1/Ea.setFromMatrixColumn(e,1).length(),s=1/Ea.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=0,t[8]=n[8]*s,t[9]=n[9]*s,t[10]=n[10]*s,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,a=e.z,s=Math.cos(n),o=Math.sin(n),l=Math.cos(r),c=Math.sin(r),h=Math.cos(a),d=Math.sin(a);if(e.order==="XYZ"){let u=s*h,p=s*d,m=o*h,g=o*d;t[0]=l*h,t[4]=-l*d,t[8]=c,t[1]=p+m*c,t[5]=u-g*c,t[9]=-o*l,t[2]=g-u*c,t[6]=m+p*c,t[10]=s*l}else if(e.order==="YXZ"){let u=l*h,p=l*d,m=c*h,g=c*d;t[0]=u+g*o,t[4]=m*o-p,t[8]=s*c,t[1]=s*d,t[5]=s*h,t[9]=-o,t[2]=p*o-m,t[6]=g+u*o,t[10]=s*l}else if(e.order==="ZXY"){let u=l*h,p=l*d,m=c*h,g=c*d;t[0]=u-g*o,t[4]=-s*d,t[8]=m+p*o,t[1]=p+m*o,t[5]=s*h,t[9]=g-u*o,t[2]=-s*c,t[6]=o,t[10]=s*l}else if(e.order==="ZYX"){let u=s*h,p=s*d,m=o*h,g=o*d;t[0]=l*h,t[4]=m*c-p,t[8]=u*c+g,t[1]=l*d,t[5]=g*c+u,t[9]=p*c-m,t[2]=-c,t[6]=o*l,t[10]=s*l}else if(e.order==="YZX"){let u=s*l,p=s*c,m=o*l,g=o*c;t[0]=l*h,t[4]=g-u*d,t[8]=m*d+p,t[1]=d,t[5]=s*h,t[9]=-o*h,t[2]=-c*h,t[6]=p*d+m,t[10]=u-g*d}else if(e.order==="XZY"){let u=s*l,p=s*c,m=o*l,g=o*c;t[0]=l*h,t[4]=-d,t[8]=c*h,t[1]=u*d+g,t[5]=s*h,t[9]=p*d-m,t[2]=m*d-p,t[6]=o*h,t[10]=g*d+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Em,e,wm)}lookAt(e,t,n){let r=this.elements;return Wi.subVectors(e,t),Wi.lengthSq()===0&&(Wi.z=1),Wi.normalize(),cr.crossVectors(n,Wi),cr.lengthSq()===0&&(Math.abs(n.z)===1?Wi.x+=1e-4:Wi.z+=1e-4,Wi.normalize(),cr.crossVectors(n,Wi)),cr.normalize(),Ro.crossVectors(Wi,cr),r[0]=cr.x,r[4]=Ro.x,r[8]=Wi.x,r[1]=cr.y,r[5]=Ro.y,r[9]=Wi.y,r[2]=cr.z,r[6]=Ro.z,r[10]=Wi.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,a=this.elements,s=n[0],o=n[4],l=n[8],c=n[12],h=n[1],d=n[5],u=n[9],p=n[13],m=n[2],g=n[6],f=n[10],y=n[14],x=n[3],v=n[7],E=n[11],S=n[15],T=r[0],C=r[4],L=r[8],I=r[12],V=r[1],X=r[5],N=r[9],oe=r[13],F=r[2],ne=r[6],$=r[10],O=r[14],q=r[3],se=r[7],Z=r[11],te=r[15];return a[0]=s*T+o*V+l*F+c*q,a[4]=s*C+o*X+l*ne+c*se,a[8]=s*L+o*N+l*$+c*Z,a[12]=s*I+o*oe+l*O+c*te,a[1]=h*T+d*V+u*F+p*q,a[5]=h*C+d*X+u*ne+p*se,a[9]=h*L+d*N+u*$+p*Z,a[13]=h*I+d*oe+u*O+p*te,a[2]=m*T+g*V+f*F+y*q,a[6]=m*C+g*X+f*ne+y*se,a[10]=m*L+g*N+f*$+y*Z,a[14]=m*I+g*oe+f*O+y*te,a[3]=x*T+v*V+E*F+S*q,a[7]=x*C+v*X+E*ne+S*se,a[11]=x*L+v*N+E*$+S*Z,a[15]=x*I+v*oe+E*O+S*te,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],a=e[12],s=e[1],o=e[5],l=e[9],c=e[13],h=e[2],d=e[6],u=e[10],p=e[14];return e[3]*(+a*l*d-r*c*d-a*o*u+n*c*u+r*o*p-n*l*p)+e[7]*(+t*l*p-t*c*u+a*s*u-r*s*p+r*c*h-a*l*h)+e[11]*(+t*c*d-t*o*p-a*s*d+n*s*p+a*o*h-n*c*h)+e[15]*(-r*o*h-t*l*d+t*o*u+r*s*d-n*s*u+n*l*h)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],a=e[3],s=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=e[9],u=e[10],p=e[11],m=e[12],g=e[13],f=e[14],y=e[15],x=d*f*c-g*u*c+g*l*p-o*f*p-d*l*y+o*u*y,v=m*u*c-h*f*c-m*l*p+s*f*p+h*l*y-s*u*y,E=h*g*c-m*d*c+m*o*p-s*g*p-h*o*y+s*d*y,S=m*d*l-h*g*l-m*o*u+s*g*u+h*o*f-s*d*f,T=t*x+n*v+r*E+a*S;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let C=1/T;return e[0]=x*C,e[1]=(g*u*a-d*f*a-g*r*p+n*f*p+d*r*y-n*u*y)*C,e[2]=(o*f*a-g*l*a+g*r*c-n*f*c-o*r*y+n*l*y)*C,e[3]=(d*l*a-o*u*a-d*r*c+n*u*c+o*r*p-n*l*p)*C,e[4]=v*C,e[5]=(h*f*a-m*u*a+m*r*p-t*f*p-h*r*y+t*u*y)*C,e[6]=(m*l*a-s*f*a-m*r*c+t*f*c+s*r*y-t*l*y)*C,e[7]=(s*u*a-h*l*a+h*r*c-t*u*c-s*r*p+t*l*p)*C,e[8]=E*C,e[9]=(m*d*a-h*g*a-m*n*p+t*g*p+h*n*y-t*d*y)*C,e[10]=(s*g*a-m*o*a+m*n*c-t*g*c-s*n*y+t*o*y)*C,e[11]=(h*o*a-s*d*a-h*n*c+t*d*c+s*n*p-t*o*p)*C,e[12]=S*C,e[13]=(h*g*r-m*d*r+m*n*u-t*g*u-h*n*f+t*d*f)*C,e[14]=(m*o*r-s*g*r-m*n*l+t*g*l+s*n*f-t*o*f)*C,e[15]=(s*d*r-h*o*r+h*n*l-t*d*l-s*n*u+t*o*u)*C,this}scale(e){let t=this.elements,n=e.x,r=e.y,a=e.z;return t[0]*=n,t[4]*=r,t[8]*=a,t[1]*=n,t[5]*=r,t[9]*=a,t[2]*=n,t[6]*=r,t[10]*=a,t[3]*=n,t[7]*=r,t[11]*=a,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),a=1-n,s=e.x,o=e.y,l=e.z,c=a*s,h=a*o;return this.set(c*s+n,c*o-r*l,c*l+r*o,0,c*o+r*l,h*o+n,h*l-r*s,0,c*l-r*o,h*l+r*s,a*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,a,s){return this.set(1,n,a,0,e,1,s,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,a=t._x,s=t._y,o=t._z,l=t._w,c=a+a,h=s+s,d=o+o,u=a*c,p=a*h,m=a*d,g=s*h,f=s*d,y=o*d,x=l*c,v=l*h,E=l*d,S=n.x,T=n.y,C=n.z;return r[0]=(1-(g+y))*S,r[1]=(p+E)*S,r[2]=(m-v)*S,r[3]=0,r[4]=(p-E)*T,r[5]=(1-(u+y))*T,r[6]=(f+x)*T,r[7]=0,r[8]=(m+v)*C,r[9]=(f-x)*C,r[10]=(1-(u+g))*C,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements,a=Ea.set(r[0],r[1],r[2]).length(),s=Ea.set(r[4],r[5],r[6]).length(),o=Ea.set(r[8],r[9],r[10]).length();this.determinant()<0&&(a=-a),e.x=r[12],e.y=r[13],e.z=r[14],yn.copy(this);let l=1/a,c=1/s,h=1/o;return yn.elements[0]*=l,yn.elements[1]*=l,yn.elements[2]*=l,yn.elements[4]*=c,yn.elements[5]*=c,yn.elements[6]*=c,yn.elements[8]*=h,yn.elements[9]*=h,yn.elements[10]*=h,t.setFromRotationMatrix(yn),n.x=a,n.y=s,n.z=o,this}makePerspective(e,t,n,r,a,s,o=2e3){let l=this.elements,c=2*a/(t-e),h=2*a/(n-r),d=(t+e)/(t-e),u=(n+r)/(n-r),p,m;if(o===Za)p=-(s+a)/(s-a),m=-2*s*a/(s-a);else{if(o!==ul)throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);p=-s/(s-a),m=-s*a/(s-a)}return l[0]=c,l[4]=0,l[8]=d,l[12]=0,l[1]=0,l[5]=h,l[9]=u,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=m,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,r,a,s,o=2e3){let l=this.elements,c=1/(t-e),h=1/(n-r),d=1/(s-a),u=(t+e)*c,p=(n+r)*h,m,g;if(o===Za)m=(s+a)*d,g=-2*d;else{if(o!==ul)throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);m=a*d,g=-1*d}return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-u,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=g,l[14]=-m,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<16;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Ea=new D,yn=new Ze,Em=new D(0,0,0),wm=new D(1,1,1),cr=new D,Ro=new D,Wi=new D,Ku=new Ze,$u=new Xt,$a=class i{constructor(e=0,t=0,n=0,r=i.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,a=r[0],s=r[4],o=r[8],l=r[1],c=r[5],h=r[9],d=r[2],u=r[6],p=r[10];switch(t){case"XYZ":this._y=Math.asin(ui(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-s,a)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ui(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,a),this._z=0);break;case"ZXY":this._x=Math.asin(ui(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,p),this._z=Math.atan2(-s,c)):(this._y=0,this._z=Math.atan2(l,a));break;case"ZYX":this._y=Math.asin(-ui(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,p),this._z=Math.atan2(l,a)):(this._x=0,this._z=Math.atan2(-s,c));break;case"YZX":this._z=Math.asin(ui(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,a)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-ui(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,a)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Ku.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Ku,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return $u.setFromEuler(this),this.setFromQuaternion($u,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};$a.DEFAULT_ORDER="XYZ";vl=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!=0}isEnabled(e){return(this.mask&(1<<e|0))!=0}},Am=0,Qu=new D,wa=new Xt,Jn=new Ze,Co=new D,ws=new D,Rm=new D,Cm=new Xt,ed=new D(1,0,0),td=new D(0,1,0),id=new D(0,0,1),Pm={type:"added"},Lm={type:"removed"},vt=class i extends mr{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Am++}),this.uuid=Sn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let e=new D,t=new $a,n=new Xt,r=new D(1,1,1);t._onChange((function(){n.setFromEuler(t,!1)})),n._onChange((function(){t.setFromQuaternion(n,void 0,!1)})),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Ze},normalMatrix:{value:new dt}}),this.matrix=new Ze,this.matrixWorld=new Ze,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new vl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return wa.setFromAxisAngle(e,t),this.quaternion.multiply(wa),this}rotateOnWorldAxis(e,t){return wa.setFromAxisAngle(e,t),this.quaternion.premultiply(wa),this}rotateX(e){return this.rotateOnAxis(ed,e)}rotateY(e){return this.rotateOnAxis(td,e)}rotateZ(e){return this.rotateOnAxis(id,e)}translateOnAxis(e,t){return Qu.copy(e).applyQuaternion(this.quaternion),this.position.add(Qu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ed,e)}translateY(e){return this.translateOnAxis(td,e)}translateZ(e){return this.translateOnAxis(id,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Jn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Co.copy(e):Co.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),ws.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Jn.lookAt(ws,Co,this.up):Jn.lookAt(Co,ws,this.up),this.quaternion.setFromRotationMatrix(Jn),r&&(Jn.extractRotation(r.matrixWorld),wa.setFromRotationMatrix(Jn),this.quaternion.premultiply(wa.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.parent!==null&&e.parent.remove(e),e.parent=this,this.children.push(e),e.dispatchEvent(Pm)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Lm)),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Jn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Jn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Jn),this.add(e),e.updateWorldMatrix(!1,!0),this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let a=0,s=r.length;a<s;a++)r[a].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ws,e,Rm),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ws,Cm,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++){let a=t[n];a.matrixWorldAutoUpdate!==!0&&e!==!0||a.updateMatrixWorld(e)}}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){let r=this.children;for(let a=0,s=r.length;a<s;a++){let o=r[a];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let r={};function a(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.visibility=this._visibility,r.active=this._active,r.bounds=this._bounds.map((o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()}))),r.maxGeometryCount=this._maxGeometryCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.geometryCount=this._geometryCount,r.matricesTexture=this._matricesTexture.toJSON(e),this.boundingSphere!==null&&(r.boundingSphere={center:r.boundingSphere.center.toArray(),radius:r.boundingSphere.radius}),this.boundingBox!==null&&(r.boundingBox={min:r.boundingBox.min.toArray(),max:r.boundingBox.max.toArray()})),this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=a(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let d=l[c];a(e.shapes,d)}else a(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(a(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(a(e.materials,this.material[l]));r.material=o}else r.material=a(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];r.animations.push(a(e.animations,l))}}if(t){let o=s(e.geometries),l=s(e.materials),c=s(e.textures),h=s(e.images),d=s(e.shapes),u=s(e.skeletons),p=s(e.animations),m=s(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),p.length>0&&(n.animations=p),m.length>0&&(n.nodes=m)}return n.object=r,n;function s(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let r=e.children[n];this.add(r.clone())}return this}};vt.DEFAULT_UP=new D(0,1,0),vt.DEFAULT_MATRIX_AUTO_UPDATE=!0,vt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;bn=new D,Kn=new D,Oc=new D,$n=new D,Aa=new D,Ra=new D,nd=new D,zc=new D,Hc=new D,Fc=new D,Po=!1,dr=class i{constructor(e=new D,t=new D,n=new D){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),bn.subVectors(e,t),r.cross(bn);let a=r.lengthSq();return a>0?r.multiplyScalar(1/Math.sqrt(a)):r.set(0,0,0)}static getBarycoord(e,t,n,r,a){bn.subVectors(r,t),Kn.subVectors(n,t),Oc.subVectors(e,t);let s=bn.dot(bn),o=bn.dot(Kn),l=bn.dot(Oc),c=Kn.dot(Kn),h=Kn.dot(Oc),d=s*c-o*o;if(d===0)return a.set(0,0,0),null;let u=1/d,p=(c*l-o*h)*u,m=(s*h-o*l)*u;return a.set(1-p-m,m,p)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,$n)!==null&&$n.x>=0&&$n.y>=0&&$n.x+$n.y<=1}static getUV(e,t,n,r,a,s,o,l){return Po===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),Po=!0),this.getInterpolation(e,t,n,r,a,s,o,l)}static getInterpolation(e,t,n,r,a,s,o,l){return this.getBarycoord(e,t,n,r,$n)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(a,$n.x),l.addScaledVector(s,$n.y),l.addScaledVector(o,$n.z),l)}static isFrontFacing(e,t,n,r){return bn.subVectors(n,t),Kn.subVectors(e,t),bn.cross(Kn).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return bn.subVectors(this.c,this.b),Kn.subVectors(this.a,this.b),.5*bn.cross(Kn).length()}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return i.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return i.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,n,r,a){return Po===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),Po=!0),i.getInterpolation(e,this.a,this.b,this.c,t,n,r,a)}getInterpolation(e,t,n,r,a){return i.getInterpolation(e,this.a,this.b,this.c,t,n,r,a)}containsPoint(e){return i.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return i.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,a=this.c,s,o;Aa.subVectors(r,n),Ra.subVectors(a,n),zc.subVectors(e,n);let l=Aa.dot(zc),c=Ra.dot(zc);if(l<=0&&c<=0)return t.copy(n);Hc.subVectors(e,r);let h=Aa.dot(Hc),d=Ra.dot(Hc);if(h>=0&&d<=h)return t.copy(r);let u=l*d-h*c;if(u<=0&&l>=0&&h<=0)return s=l/(l-h),t.copy(n).addScaledVector(Aa,s);Fc.subVectors(e,a);let p=Aa.dot(Fc),m=Ra.dot(Fc);if(m>=0&&p<=m)return t.copy(a);let g=p*c-l*m;if(g<=0&&c>=0&&m<=0)return o=c/(c-m),t.copy(n).addScaledVector(Ra,o);let f=h*m-p*d;if(f<=0&&d-h>=0&&p-m>=0)return nd.subVectors(a,r),o=(d-h)/(d-h+(p-m)),t.copy(r).addScaledVector(nd,o);let y=1/(f+g+u);return s=g*y,o=u*y,t.copy(n).addScaledVector(Aa,s).addScaledVector(Ra,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},gp={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},hr={h:0,s:0,l:0},Lo={h:0,s:0,l:0};ke=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=$t){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(255&e)/255,Rt.toWorkingColorSpace(this,t),this}setRGB(e,t,n,r=Rt.workingColorSpace){return this.r=e,this.g=t,this.b=n,Rt.toWorkingColorSpace(this,r),this}setHSL(e,t,n,r=Rt.workingColorSpace){if(e=m0(e,1),t=ui(t,0,1),n=ui(n,0,1),t===0)this.r=this.g=this.b=n;else{let a=n<=.5?n*(1+t):n+t-n*t,s=2*n-a;this.r=Gc(s,a,e+1/3),this.g=Gc(s,a,e),this.b=Gc(s,a,e-1/3)}return Rt.toWorkingColorSpace(this,r),this}setStyle(e,t=$t){function n(a){a!==void 0&&parseFloat(a)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let a,s=r[1],o=r[2];switch(s){case"rgb":case"rgba":if(a=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setRGB(Math.min(255,parseInt(a[1],10))/255,Math.min(255,parseInt(a[2],10))/255,Math.min(255,parseInt(a[3],10))/255,t);if(a=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setRGB(Math.min(100,parseInt(a[1],10))/100,Math.min(100,parseInt(a[2],10))/100,Math.min(100,parseInt(a[3],10))/100,t);break;case"hsl":case"hsla":if(a=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setHSL(parseFloat(a[1])/360,parseFloat(a[2])/100,parseFloat(a[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let a=r[1],s=a.length;if(s===3)return this.setRGB(parseInt(a.charAt(0),16)/15,parseInt(a.charAt(1),16)/15,parseInt(a.charAt(2),16)/15,t);if(s===6)return this.setHex(parseInt(a,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=$t){let n=gp[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Va(e.r),this.g=Va(e.g),this.b=Va(e.b),this}copyLinearToSRGB(e){return this.r=Pc(e.r),this.g=Pc(e.g),this.b=Pc(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=$t){return Rt.fromWorkingColorSpace(Ei.copy(this),e),65536*Math.round(ui(255*Ei.r,0,255))+256*Math.round(ui(255*Ei.g,0,255))+Math.round(ui(255*Ei.b,0,255))}getHexString(e=$t){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Rt.workingColorSpace){Rt.fromWorkingColorSpace(Ei.copy(this),t);let n=Ei.r,r=Ei.g,a=Ei.b,s=Math.max(n,r,a),o=Math.min(n,r,a),l,c,h=(o+s)/2;if(o===s)l=0,c=0;else{let d=s-o;switch(c=h<=.5?d/(s+o):d/(2-s-o),s){case n:l=(r-a)/d+(r<a?6:0);break;case r:l=(a-n)/d+2;break;case a:l=(n-r)/d+4}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Rt.workingColorSpace){return Rt.fromWorkingColorSpace(Ei.copy(this),t),e.r=Ei.r,e.g=Ei.g,e.b=Ei.b,e}getStyle(e=$t){Rt.fromWorkingColorSpace(Ei.copy(this),e);let t=Ei.r,n=Ei.g,r=Ei.b;return e!==$t?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(255*t)},${Math.round(255*n)},${Math.round(255*r)})`}offsetHSL(e,t,n){return this.getHSL(hr),this.setHSL(hr.h+e,hr.s+t,hr.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(hr),e.getHSL(Lo);let n=ks(hr.h,Lo.h,t),r=ks(hr.s,Lo.s,t),a=ks(hr.l,Lo.l,t);return this.setHSL(n,r,a),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,a=e.elements;return this.r=a[0]*t+a[3]*n+a[6]*r,this.g=a[1]*t+a[4]*n+a[7]*r,this.b=a[2]*t+a[5]*n+a[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ei=new ke;ke.NAMES=gp;Im=0,Un=class extends mr{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Im++}),this.uuid=Sn(),this.name="",this.type="Material",this.blending=1,this.side=ni,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=l0,this.blendDst=c0,this.blendEquation=Hr,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ke(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ba,this.stencilZFail=ba,this.stencilZPass=ba,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];r!==void 0?r&&r.isColor?r.set(n):r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n:console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`)}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};function r(a){let s=[];for(let o in a){let l=a[o];delete l.metadata,s.push(l)}return s}if(n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==ni&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==l0&&(n.blendSrc=this.blendSrc),this.blendDst!==c0&&(n.blendDst=this.blendDst),this.blendEquation!==Hr&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ba&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ba&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ba&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData),t){let a=r(e.textures),s=r(e.images);a.length>0&&(n.textures=a),s.length>0&&(n.images=s)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let r=t.length;n=new Array(r);for(let a=0;a!==r;++a)n[a]=t[a].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}},Pt=class extends Un{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=ap,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},yx=Dm();ii=new D,Io=new Re,jt=class{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=p0,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=ir,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,a=this.itemSize;r<a;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Io.fromBufferAttribute(this,t),Io.applyMatrix3(e),this.setXY(t,Io.x,Io.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)ii.fromBufferAttribute(this,t),ii.applyMatrix3(e),this.setXYZ(t,ii.x,ii.y,ii.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)ii.fromBufferAttribute(this,t),ii.applyMatrix4(e),this.setXYZ(t,ii.x,ii.y,ii.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)ii.fromBufferAttribute(this,t),ii.applyNormalMatrix(e),this.setXYZ(t,ii.x,ii.y,ii.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)ii.fromBufferAttribute(this,t),ii.transformDirection(e),this.setXYZ(t,ii.x,ii.y,ii.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Dn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=It(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Dn(t,this.array)),t}setX(e,t){return this.normalized&&(t=It(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Dn(t,this.array)),t}setY(e,t){return this.normalized&&(t=It(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Dn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=It(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Dn(t,this.array)),t}setW(e,t){return this.normalized&&(t=It(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=It(t,this.array),n=It(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=It(t,this.array),n=It(n,this.array),r=It(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,a){return e*=this.itemSize,this.normalized&&(t=It(t,this.array),n=It(n,this.array),r=It(r,this.array),a=It(a,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=a,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==p0&&(e.usage=this.usage),e}},rr=class extends jt{constructor(e,t,n){super(new Uint16Array(e),t,n)}},xl=class extends jt{constructor(e,t,n){super(new Uint32Array(e),t,n)}},He=class extends jt{constructor(e,t,n){super(new Float32Array(e),t,n)}},Um=0,tn=new Ze,Vc=new vt,Ca=new D,ji=new nn,As=new nn,ci=new D,ut=class i extends mr{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Um++}),this.uuid=Sn(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(mp(e)?xl:rr)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let a=new dt().getNormalMatrix(e);n.applyNormalMatrix(a),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return tn.makeRotationFromQuaternion(e),this.applyMatrix4(tn),this}rotateX(e){return tn.makeRotationX(e),this.applyMatrix4(tn),this}rotateY(e){return tn.makeRotationY(e),this.applyMatrix4(tn),this}rotateZ(e){return tn.makeRotationZ(e),this.applyMatrix4(tn),this}translate(e,t,n){return tn.makeTranslation(e,t,n),this.applyMatrix4(tn),this}scale(e,t,n){return tn.makeScale(e,t,n),this.applyMatrix4(tn),this}lookAt(e){return Vc.lookAt(e),Vc.updateMatrix(),this.applyMatrix4(Vc.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ca).negate(),this.translate(Ca.x,Ca.y,Ca.z),this}setFromPoints(e){let t=[];for(let n=0,r=e.length;n<r;n++){let a=e[n];t.push(a.x,a.y,a.z||0)}return this.setAttribute("position",new He(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new nn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)return console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),void this.boundingBox.set(new D(-1/0,-1/0,-1/0),new D(1/0,1/0,1/0));if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,r=t.length;n<r;n++){let a=t[n];ji.setFromBufferAttribute(a),this.morphTargetsRelative?(ci.addVectors(this.boundingBox.min,ji.min),this.boundingBox.expandByPoint(ci),ci.addVectors(this.boundingBox.max,ji.max),this.boundingBox.expandByPoint(ci)):(this.boundingBox.expandByPoint(ji.min),this.boundingBox.expandByPoint(ji.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new rn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)return console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),void this.boundingSphere.set(new D,1/0);if(e){let n=this.boundingSphere.center;if(ji.setFromBufferAttribute(e),t)for(let a=0,s=t.length;a<s;a++){let o=t[a];As.setFromBufferAttribute(o),this.morphTargetsRelative?(ci.addVectors(ji.min,As.min),ji.expandByPoint(ci),ci.addVectors(ji.max,As.max),ji.expandByPoint(ci)):(ji.expandByPoint(As.min),ji.expandByPoint(As.max))}ji.getCenter(n);let r=0;for(let a=0,s=e.count;a<s;a++)ci.fromBufferAttribute(e,a),r=Math.max(r,n.distanceToSquared(ci));if(t)for(let a=0,s=t.length;a<s;a++){let o=t[a],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)ci.fromBufferAttribute(o,c),l&&(Ca.fromBufferAttribute(e,c),ci.add(Ca)),r=Math.max(r,n.distanceToSquared(ci))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0)return void console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");let n=e.array,r=t.position.array,a=t.normal.array,s=t.uv.array,o=r.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new jt(new Float32Array(4*o),4));let l=this.getAttribute("tangent").array,c=[],h=[];for(let V=0;V<o;V++)c[V]=new D,h[V]=new D;let d=new D,u=new D,p=new D,m=new Re,g=new Re,f=new Re,y=new D,x=new D;function v(V,X,N){d.fromArray(r,3*V),u.fromArray(r,3*X),p.fromArray(r,3*N),m.fromArray(s,2*V),g.fromArray(s,2*X),f.fromArray(s,2*N),u.sub(d),p.sub(d),g.sub(m),f.sub(m);let oe=1/(g.x*f.y-f.x*g.y);isFinite(oe)&&(y.copy(u).multiplyScalar(f.y).addScaledVector(p,-g.y).multiplyScalar(oe),x.copy(p).multiplyScalar(g.x).addScaledVector(u,-f.x).multiplyScalar(oe),c[V].add(y),c[X].add(y),c[N].add(y),h[V].add(x),h[X].add(x),h[N].add(x))}let E=this.groups;E.length===0&&(E=[{start:0,count:n.length}]);for(let V=0,X=E.length;V<X;++V){let N=E[V],oe=N.start;for(let F=oe,ne=oe+N.count;F<ne;F+=3)v(n[F+0],n[F+1],n[F+2])}let S=new D,T=new D,C=new D,L=new D;function I(V){C.fromArray(a,3*V),L.copy(C);let X=c[V];S.copy(X),S.sub(C.multiplyScalar(C.dot(X))).normalize(),T.crossVectors(L,X);let N=T.dot(h[V])<0?-1:1;l[4*V]=S.x,l[4*V+1]=S.y,l[4*V+2]=S.z,l[4*V+3]=N}for(let V=0,X=E.length;V<X;++V){let N=E[V],oe=N.start;for(let F=oe,ne=oe+N.count;F<ne;F+=3)I(n[F+0]),I(n[F+1]),I(n[F+2])}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new jt(new Float32Array(3*t.count),3),this.setAttribute("normal",n);else for(let u=0,p=n.count;u<p;u++)n.setXYZ(u,0,0,0);let r=new D,a=new D,s=new D,o=new D,l=new D,c=new D,h=new D,d=new D;if(e)for(let u=0,p=e.count;u<p;u+=3){let m=e.getX(u+0),g=e.getX(u+1),f=e.getX(u+2);r.fromBufferAttribute(t,m),a.fromBufferAttribute(t,g),s.fromBufferAttribute(t,f),h.subVectors(s,a),d.subVectors(r,a),h.cross(d),o.fromBufferAttribute(n,m),l.fromBufferAttribute(n,g),c.fromBufferAttribute(n,f),o.add(h),l.add(h),c.add(h),n.setXYZ(m,o.x,o.y,o.z),n.setXYZ(g,l.x,l.y,l.z),n.setXYZ(f,c.x,c.y,c.z)}else for(let u=0,p=t.count;u<p;u+=3)r.fromBufferAttribute(t,u+0),a.fromBufferAttribute(t,u+1),s.fromBufferAttribute(t,u+2),h.subVectors(s,a),d.subVectors(r,a),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)ci.fromBufferAttribute(e,t),ci.normalize(),e.setXYZ(t,ci.x,ci.y,ci.z)}toNonIndexed(){function e(o,l){let c=o.array,h=o.itemSize,d=o.normalized,u=new c.constructor(l.length*h),p=0,m=0;for(let g=0,f=l.length;g<f;g++){p=o.isInterleavedBufferAttribute?l[g]*o.data.stride+o.offset:l[g]*h;for(let y=0;y<h;y++)u[m++]=c[p++]}return new jt(u,h,d)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new i,n=this.index.array,r=this.attributes;for(let o in r){let l=e(r[o],n);t.setAttribute(o,l)}let a=this.morphAttributes;for(let o in a){let l=[],c=a[o];for(let h=0,d=c.length;h<d;h++){let u=e(c[h],n);l.push(u)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;for(let o=0,l=s.length;o<l;o++){let c=s[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},a=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let d=0,u=c.length;d<u;d++){let p=c[d];h.push(p.toJSON(e.data))}h.length>0&&(r[l]=h,a=!0)}a&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let s=this.groups;s.length>0&&(e.data.groups=JSON.parse(JSON.stringify(s)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone(t));let r=e.attributes;for(let c in r){let h=r[c];this.setAttribute(c,h.clone(t))}let a=e.morphAttributes;for(let c in a){let h=[],d=a[c];for(let u=0,p=d.length;u<p;u++)h.push(d[u].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let s=e.groups;for(let c=0,h=s.length;c<h;c++){let d=s[c];this.addGroup(d.start,d.count,d.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},rd=new Ze,Br=new Ka,Do=new rn,ad=new D,Pa=new D,La=new D,Ia=new D,Wc=new D,Uo=new D,ko=new Re,No=new Re,Bo=new Re,sd=new D,od=new D,ld=new D,Oo=new D,zo=new D,yt=class extends vt{constructor(e=new ut,t=new Pt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){let s=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=r}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,a=n.morphAttributes.position,s=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(a&&o){Uo.set(0,0,0);for(let l=0,c=a.length;l<c;l++){let h=o[l],d=a[l];h!==0&&(Wc.fromBufferAttribute(d,e),s?Uo.addScaledVector(Wc,h):Uo.addScaledVector(Wc.sub(t),h))}t.add(Uo)}return t}raycast(e,t){let n=this.geometry,r=this.material,a=this.matrixWorld;if(r!==void 0){if(n.boundingSphere===null&&n.computeBoundingSphere(),Do.copy(n.boundingSphere),Do.applyMatrix4(a),Br.copy(e.ray).recast(e.near),Do.containsPoint(Br.origin)===!1&&(Br.intersectSphere(Do,ad)===null||Br.origin.distanceToSquared(ad)>(e.far-e.near)**2))return;rd.copy(a).invert(),Br.copy(e.ray).applyMatrix4(rd),n.boundingBox!==null&&Br.intersectsBox(n.boundingBox)===!1||this._computeIntersections(e,t,Br)}}_computeIntersections(e,t,n){let r,a=this.geometry,s=this.material,o=a.index,l=a.attributes.position,c=a.attributes.uv,h=a.attributes.uv1,d=a.attributes.normal,u=a.groups,p=a.drawRange;if(o!==null)if(Array.isArray(s))for(let m=0,g=u.length;m<g;m++){let f=u[m],y=s[f.materialIndex];for(let x=Math.max(f.start,p.start),v=Math.min(o.count,Math.min(f.start+f.count,p.start+p.count));x<v;x+=3)r=Ho(this,y,e,n,c,h,d,o.getX(x),o.getX(x+1),o.getX(x+2)),r&&(r.faceIndex=Math.floor(x/3),r.face.materialIndex=f.materialIndex,t.push(r))}else for(let m=Math.max(0,p.start),g=Math.min(o.count,p.start+p.count);m<g;m+=3)r=Ho(this,s,e,n,c,h,d,o.getX(m),o.getX(m+1),o.getX(m+2)),r&&(r.faceIndex=Math.floor(m/3),t.push(r));else if(l!==void 0)if(Array.isArray(s))for(let m=0,g=u.length;m<g;m++){let f=u[m],y=s[f.materialIndex];for(let x=Math.max(f.start,p.start),v=Math.min(l.count,Math.min(f.start+f.count,p.start+p.count));x<v;x+=3)r=Ho(this,y,e,n,c,h,d,x,x+1,x+2),r&&(r.faceIndex=Math.floor(x/3),r.face.materialIndex=f.materialIndex,t.push(r))}else for(let m=Math.max(0,p.start),g=Math.min(l.count,p.start+p.count);m<g;m+=3)r=Ho(this,s,e,n,c,h,d,m,m+1,m+2),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}};Xe=class i extends ut{constructor(e=1,t=1,n=1,r=1,a=1,s=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:a,depthSegments:s};let o=this;r=Math.floor(r),a=Math.floor(a),s=Math.floor(s);let l=[],c=[],h=[],d=[],u=0,p=0;function m(g,f,y,x,v,E,S,T,C,L,I){let V=E/C,X=S/L,N=E/2,oe=S/2,F=T/2,ne=C+1,$=L+1,O=0,q=0,se=new D;for(let Z=0;Z<$;Z++){let te=Z*X-oe;for(let Ce=0;Ce<ne;Ce++){let R=Ce*V-N;se[g]=R*x,se[f]=te*v,se[y]=F,c.push(se.x,se.y,se.z),se[g]=0,se[f]=0,se[y]=T>0?1:-1,h.push(se.x,se.y,se.z),d.push(Ce/C),d.push(1-Z/L),O+=1}}for(let Z=0;Z<L;Z++)for(let te=0;te<C;te++){let Ce=u+te+ne*Z,R=u+te+ne*(Z+1),w=u+(te+1)+ne*(Z+1),K=u+(te+1)+ne*Z;l.push(Ce,R,K),l.push(R,w,K),q+=6}o.addGroup(p,q,I),p+=q,u+=O}m("z","y","x",-1,-1,n,t,e,s,a,0),m("z","y","x",1,-1,n,t,-e,s,a,1),m("x","z","y",1,1,e,n,t,r,s,2),m("x","z","y",1,-1,e,n,-t,r,s,3),m("x","y","z",1,-1,e,t,n,r,a,4),m("x","y","z",-1,-1,e,t,-n,r,a,5),this.setIndex(l),this.setAttribute("position",new He(c,3)),this.setAttribute("normal",new He(h,3)),this.setAttribute("uv",new He(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};xr={clone:Qa,merge:Pi},qt=class extends Un{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,this.fragmentShader=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Qa(e.uniforms),this.uniformsGroups=(function(t){let n=[];for(let r=0;r<t.length;r++)n.push(t[r].clone());return n})(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let a=this.uniforms[r].value;a&&a.isTexture?t.uniforms[r]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[r]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[r]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[r]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[r]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[r]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[r]={type:"m4",value:a.toArray()}:t.uniforms[r]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let r in this.extensions)this.extensions[r]===!0&&(n[r]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},Fs=class extends vt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ze,this.projectionMatrix=new Ze,this.projectionMatrixInverse=new Ze,this.coordinateSystem=Za}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},bi=class extends Fs{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=2*Ja*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(.5*Ga*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return 2*Ja*Math.atan(Math.tan(.5*Ga*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(e,t,n,r,a,s){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=a,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(.5*Ga*this.fov)/this.zoom,n=2*t,r=this.aspect*n,a=-.5*r,s=this.view;if(this.view!==null&&this.view.enabled){let l=s.fullWidth,c=s.fullHeight;a+=s.offsetX*r/l,t-=s.offsetY*n/c,r*=s.width/l,n*=s.height/c}let o=this.filmOffset;o!==0&&(a+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(a,a+r,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},Da=-90,y0=class extends vt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new bi(Da,1,e,t);r.layers=this.layers,this.add(r);let a=new bi(Da,1,e,t);a.layers=this.layers,this.add(a);let s=new bi(Da,1,e,t);s.layers=this.layers,this.add(s);let o=new bi(Da,1,e,t);o.layers=this.layers,this.add(o);let l=new bi(Da,1,e,t);l.layers=this.layers,this.add(l);let c=new bi(Da,1,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,a,s,o,l]=t;for(let c of t)this.remove(c);if(e===Za)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),a.up.set(0,0,-1),a.lookAt(0,1,0),s.up.set(0,0,1),s.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else{if(e!==ul)throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),a.up.set(0,0,1),a.lookAt(0,1,0),s.up.set(0,0,-1),s.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1)}for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[a,s,o,l,c,h]=this.children,d=e.getRenderTarget(),u=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;let g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,r),e.render(t,a),e.setRenderTarget(n,1,r),e.render(t,s),e.setRenderTarget(n,2,r),e.render(t,o),e.setRenderTarget(n,3,r),e.render(t,l),e.setRenderTarget(n,4,r),e.render(t,c),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,r),e.render(t,h),e.setRenderTarget(d,u,p),e.xr.enabled=m,n.texture.needsPMREMUpdate=!0}},yl=class extends Xi{constructor(e,t,n,r,a,s,o,l,c,h){super(e=e!==void 0?e:[],t=t!==void 0?t:ja,n,r,a,s,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},b0=class extends _i{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];t.encoding!==void 0&&(Ns("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),t.colorSpace=t.encoding===Xr?$t:In),this.texture=new yl(r,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0&&t.generateMipmaps,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:_n}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Xe(5,5,5),a=new qt({name:"CubemapFromEquirect",uniforms:Qa(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:di,blending:0});a.uniforms.tEquirect.value=t;let s=new yt(r,a),o=t.minFilter;return t.minFilter===al&&(t.minFilter=_n),new y0(1,10,this).update(e,s),t.minFilter=o,s.geometry.dispose(),s.material.dispose(),this}clear(e,t,n,r){let a=e.getRenderTarget();for(let s=0;s<6;s++)e.setRenderTarget(this,s),e.clear(t,n,r);e.setRenderTarget(a)}},jc=new D,km=new D,Nm=new dt,er=class{constructor(e=new D(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=jc.subVectors(n,t).cross(km.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){let n=e.delta(jc),r=this.normal.dot(n);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/r;return a<0||a>1?null:t.copy(e.start).addScaledVector(n,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Nm.getNormalMatrix(e),r=this.coplanarPoint(jc).applyMatrix4(e),a=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(a),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Or=new rn,Fo=new D,es=class{constructor(e=new er,t=new er,n=new er,r=new er,a=new er,s=new er){this.planes=[e,t,n,r,a,s]}set(e,t,n,r,a,s){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(a),o[5].copy(s),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=2e3){let n=this.planes,r=e.elements,a=r[0],s=r[1],o=r[2],l=r[3],c=r[4],h=r[5],d=r[6],u=r[7],p=r[8],m=r[9],g=r[10],f=r[11],y=r[12],x=r[13],v=r[14],E=r[15];if(n[0].setComponents(l-a,u-c,f-p,E-y).normalize(),n[1].setComponents(l+a,u+c,f+p,E+y).normalize(),n[2].setComponents(l+s,u+h,f+m,E+x).normalize(),n[3].setComponents(l-s,u-h,f-m,E-x).normalize(),n[4].setComponents(l-o,u-d,f-g,E-v).normalize(),t===Za)n[5].setComponents(l+o,u+d,f+g,E+v).normalize();else{if(t!==ul)throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);n[5].setComponents(o,d,g,v).normalize()}return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Or.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Or.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Or)}intersectsSprite(e){return Or.center.set(0,0,0),Or.radius=.7071067811865476,Or.applyMatrix4(e.matrixWorld),this.intersectsSphere(Or)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let a=0;a<6;a++)if(t[a].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(Fo.x=r.normal.x>0?e.max.x:e.min.x,Fo.y=r.normal.y>0?e.max.y:e.min.y,Fo.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Fo)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};pi=class i extends ut{constructor(e=1,t=1,n=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let a=e/2,s=t/2,o=Math.floor(n),l=Math.floor(r),c=o+1,h=l+1,d=e/o,u=t/l,p=[],m=[],g=[],f=[];for(let y=0;y<h;y++){let x=y*u-s;for(let v=0;v<c;v++){let E=v*d-a;m.push(E,-x,0),g.push(0,0,1),f.push(v/o),f.push(1-y/l)}}for(let y=0;y<l;y++)for(let x=0;x<o;x++){let v=x+c*y,E=x+c*(y+1),S=x+1+c*(y+1),T=x+1+c*y;p.push(v,E,T),p.push(E,S,T)}this.setIndex(p),this.setAttribute("position",new He(m,3)),this.setAttribute("normal",new He(g,3)),this.setAttribute("uv",new He(f,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.widthSegments,e.heightSegments)}},ot={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:"gl_FragColor = linearToOutputTexel( gl_FragColor );",colorspace_pars_fragment:`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_fragment:`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color *= toneMappingExposure;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return color;
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
		vec3 refractedRayExit = position + transmissionRay;
		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
		vec2 refractionCoords = ndcPos.xy / ndcPos.w;
		refractionCoords += 1.0;
		refractionCoords /= 2.0;
		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,distanceRGBA_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distanceRGBA_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Be={common:{diffuse:{value:new ke(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new dt},alphaMap:{value:null},alphaMapTransform:{value:new dt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new dt}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new dt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new dt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new dt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new dt},normalScale:{value:new Re(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new dt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new dt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new dt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new dt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ke(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ke(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new dt},alphaTest:{value:0},uvTransform:{value:new dt}},sprite:{diffuse:{value:new ke(16777215)},opacity:{value:1},center:{value:new Re(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new dt},alphaMap:{value:null},alphaMapTransform:{value:new dt},alphaTest:{value:0}}},Ln={basic:{uniforms:Pi([Be.common,Be.specularmap,Be.envmap,Be.aomap,Be.lightmap,Be.fog]),vertexShader:ot.meshbasic_vert,fragmentShader:ot.meshbasic_frag},lambert:{uniforms:Pi([Be.common,Be.specularmap,Be.envmap,Be.aomap,Be.lightmap,Be.emissivemap,Be.bumpmap,Be.normalmap,Be.displacementmap,Be.fog,Be.lights,{emissive:{value:new ke(0)}}]),vertexShader:ot.meshlambert_vert,fragmentShader:ot.meshlambert_frag},phong:{uniforms:Pi([Be.common,Be.specularmap,Be.envmap,Be.aomap,Be.lightmap,Be.emissivemap,Be.bumpmap,Be.normalmap,Be.displacementmap,Be.fog,Be.lights,{emissive:{value:new ke(0)},specular:{value:new ke(1118481)},shininess:{value:30}}]),vertexShader:ot.meshphong_vert,fragmentShader:ot.meshphong_frag},standard:{uniforms:Pi([Be.common,Be.envmap,Be.aomap,Be.lightmap,Be.emissivemap,Be.bumpmap,Be.normalmap,Be.displacementmap,Be.roughnessmap,Be.metalnessmap,Be.fog,Be.lights,{emissive:{value:new ke(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:ot.meshphysical_vert,fragmentShader:ot.meshphysical_frag},toon:{uniforms:Pi([Be.common,Be.aomap,Be.lightmap,Be.emissivemap,Be.bumpmap,Be.normalmap,Be.displacementmap,Be.gradientmap,Be.fog,Be.lights,{emissive:{value:new ke(0)}}]),vertexShader:ot.meshtoon_vert,fragmentShader:ot.meshtoon_frag},matcap:{uniforms:Pi([Be.common,Be.bumpmap,Be.normalmap,Be.displacementmap,Be.fog,{matcap:{value:null}}]),vertexShader:ot.meshmatcap_vert,fragmentShader:ot.meshmatcap_frag},points:{uniforms:Pi([Be.points,Be.fog]),vertexShader:ot.points_vert,fragmentShader:ot.points_frag},dashed:{uniforms:Pi([Be.common,Be.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:ot.linedashed_vert,fragmentShader:ot.linedashed_frag},depth:{uniforms:Pi([Be.common,Be.displacementmap]),vertexShader:ot.depth_vert,fragmentShader:ot.depth_frag},normal:{uniforms:Pi([Be.common,Be.bumpmap,Be.normalmap,Be.displacementmap,{opacity:{value:1}}]),vertexShader:ot.meshnormal_vert,fragmentShader:ot.meshnormal_frag},sprite:{uniforms:Pi([Be.sprite,Be.fog]),vertexShader:ot.sprite_vert,fragmentShader:ot.sprite_frag},background:{uniforms:{uvTransform:{value:new dt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:ot.background_vert,fragmentShader:ot.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:ot.backgroundCube_vert,fragmentShader:ot.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:ot.cube_vert,fragmentShader:ot.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:ot.equirect_vert,fragmentShader:ot.equirect_frag},distanceRGBA:{uniforms:Pi([Be.common,Be.displacementmap,{referencePosition:{value:new D},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:ot.distanceRGBA_vert,fragmentShader:ot.distanceRGBA_frag},shadow:{uniforms:Pi([Be.lights,Be.fog,{color:{value:new ke(0)},opacity:{value:1}}]),vertexShader:ot.shadow_vert,fragmentShader:ot.shadow_frag}};Ln.physical={uniforms:Pi([Ln.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new dt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new dt},clearcoatNormalScale:{value:new Re(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new dt},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new dt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new dt},sheen:{value:0},sheenColor:{value:new ke(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new dt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new dt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new dt},transmissionSamplerSize:{value:new Re},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new dt},attenuationDistance:{value:0},attenuationColor:{value:new ke(0)},specularColor:{value:new ke(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new dt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new dt},anisotropyVector:{value:new Re},anisotropyMap:{value:null},anisotropyMapTransform:{value:new dt}}]),vertexShader:ot.meshphysical_vert,fragmentShader:ot.meshphysical_frag};Go={r:0,b:0,g:0};gr=class extends Fs{constructor(e=-1,t=1,n=1,r=-1,a=.1,s=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=a,this.far=s,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,a,s){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=a,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,a=n-e,s=n+e,o=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;a+=c*this.view.offsetX,s=a+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(a,s,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},cd=[.125,.215,.35,.446,.526,.582],Rs=20,Xc=new gr,hd=new ke,qc=null,Yc=0,Zc=0,zr=(1+Math.sqrt(5))/2,Ua=1/zr,ud=[new D(1,1,1),new D(-1,1,1),new D(1,1,-1),new D(-1,1,-1),new D(0,zr,Ua),new D(0,zr,-Ua),new D(Ua,0,zr),new D(-Ua,0,zr),new D(zr,Ua,0),new D(-zr,Ua,0)],bl=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,r=100){qc=this._renderer.getRenderTarget(),Yc=this._renderer.getActiveCubeFace(),Zc=this._renderer.getActiveMipmapLevel(),this._setSize(256);let a=this._allocateTargets();return a.depthBuffer=!0,this._sceneToCubeUV(e,n,r,a),t>0&&this._blur(a,0,0,t),this._applyPMREM(a),this._cleanup(a),a}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=fd(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=pd(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(qc,Yc,Zc),e.scissorTest=!1,Vo(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===ja||e.mapping===Xa?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),qc=this._renderer.getRenderTarget(),Yc=this._renderer.getActiveCubeFace(),Zc=this._renderer.getActiveMipmapLevel();let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:_n,minFilter:_n,generateMipmaps:!1,type:qi,format:Mn,colorSpace:nr,depthBuffer:!1},r=dd(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=dd(e,t,n);let{_lodMax:a}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=(function(s){let o=[],l=[],c=[],h=s,d=s-4+1+cd.length;for(let u=0;u<d;u++){let p=Math.pow(2,h);l.push(p);let m=1/p;u>s-4?m=cd[u-s+4-1]:u===0&&(m=0),c.push(m);let g=1/(p-2),f=-g,y=1+g,x=[f,f,y,f,y,y,f,f,y,y,f,y],v=6,E=6,S=3,T=2,C=1,L=new Float32Array(S*E*v),I=new Float32Array(T*E*v),V=new Float32Array(C*E*v);for(let N=0;N<v;N++){let oe=N%3*2/3-1,F=N>2?0:-1,ne=[oe,F,0,oe+2/3,F,0,oe+2/3,F+1,0,oe,F,0,oe+2/3,F+1,0,oe,F+1,0];L.set(ne,S*E*N),I.set(x,T*E*N);let $=[N,N,N,N,N,N];V.set($,C*E*N)}let X=new ut;X.setAttribute("position",new jt(L,S)),X.setAttribute("uv",new jt(I,T)),X.setAttribute("faceIndex",new jt(V,C)),o.push(X),h>4&&h--}return{lodPlanes:o,sizeLods:l,sigmas:c}})(a)),this._blurMaterial=(function(s,o,l){let c=new Float32Array(Rs),h=new D(0,1,0);return new qt({name:"SphericalGaussianBlur",defines:{n:Rs,CUBEUV_TEXEL_WIDTH:1/o,CUBEUV_TEXEL_HEIGHT:1/l,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:c},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:h}},vertexShader:ph(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:0,depthTest:!1,depthWrite:!1})})(a,e,t)}return r}_compileMaterial(e){let t=new yt(this._lodPlanes[0],e);this._renderer.compile(t,Xc)}_sceneToCubeUV(e,t,n,r){let a=new bi(90,1,t,n),s=[1,-1,1,1,1,1],o=[1,1,1,-1,-1,-1],l=this._renderer,c=l.autoClear,h=l.toneMapping;l.getClearColor(hd),l.toneMapping=pr,l.autoClear=!1;let d=new Pt({name:"PMREM.Background",side:di,depthWrite:!1,depthTest:!1}),u=new yt(new Xe,d),p=!1,m=e.background;m?m.isColor&&(d.color.copy(m),e.background=null,p=!0):(d.color.copy(hd),p=!0);for(let g=0;g<6;g++){let f=g%3;f===0?(a.up.set(0,s[g],0),a.lookAt(o[g],0,0)):f===1?(a.up.set(0,0,s[g]),a.lookAt(0,o[g],0)):(a.up.set(0,s[g],0),a.lookAt(0,0,o[g]));let y=this._cubeSize;Vo(r,f*y,g>2?y:0,y,y),l.setRenderTarget(r),p&&l.render(u,a),l.render(e,a)}u.geometry.dispose(),u.material.dispose(),l.toneMapping=h,l.autoClear=c,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===ja||e.mapping===Xa;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=fd()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=pd());let a=r?this._cubemapMaterial:this._equirectMaterial,s=new yt(this._lodPlanes[0],a);a.uniforms.envMap.value=e;let o=this._cubeSize;Vo(t,0,0,3*o,2*o),n.setRenderTarget(t),n.render(s,Xc)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;for(let r=1;r<this._lodPlanes.length;r++){let a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),s=ud[(r-1)%ud.length];this._blur(e,r-1,r,a,s)}t.autoClear=n}_blur(e,t,n,r,a){let s=this._pingPongRenderTarget;this._halfBlur(e,s,t,n,r,"latitudinal",a),this._halfBlur(s,e,n,n,r,"longitudinal",a)}_halfBlur(e,t,n,r,a,s,o){let l=this._renderer,c=this._blurMaterial;s!=="latitudinal"&&s!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=new yt(this._lodPlanes[r],c),d=c.uniforms,u=this._sizeLods[n]-1,p=isFinite(a)?Math.PI/(2*u):2*Math.PI/39,m=a/p,g=isFinite(a)?1+Math.floor(3*m):Rs;g>Rs&&console.warn(`sigmaRadians, ${a}, is too large and will clip, as it requested ${g} samples when the maximum is set to 20`);let f=[],y=0;for(let E=0;E<Rs;++E){let S=E/m,T=Math.exp(-S*S/2);f.push(T),E===0?y+=T:E<g&&(y+=2*T)}for(let E=0;E<f.length;E++)f[E]=f[E]/y;d.envMap.value=e.texture,d.samples.value=g,d.weights.value=f,d.latitudinal.value=s==="latitudinal",o&&(d.poleAxis.value=o);let{_lodMax:x}=this;d.dTheta.value=p,d.mipInt.value=x-n;let v=this._sizeLods[r];Vo(t,3*v*(r>x-4?r-x+4:0),4*(this._cubeSize-v),3*v,2*v),l.setRenderTarget(t),l.render(h,Xc)}};_l=class extends Xi{constructor(e,t,n,r,a,s,o,l,c,h){if((h=h!==void 0?h:jr)!==jr&&h!==Ya)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===jr&&(n=ur),n===void 0&&h===Ya&&(n=Wr),super(null,r,a,s,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=o!==void 0?o:hi,this.minFilter=l!==void 0?l:hi,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},yp=new Xi,bp=new _l(1,1);bp.compareFunction=515;_p=new gl,Mp=new x0,Sp=new yl,md=[],gd=[],vd=new Float32Array(16),xd=new Float32Array(9),yd=new Float32Array(4);_0=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=(function(r){switch(r){case 5126:return Qm;case 35664:return eg;case 35665:return tg;case 35666:return ig;case 35674:return ng;case 35675:return rg;case 35676:return ag;case 5124:case 35670:return sg;case 35667:case 35671:return og;case 35668:case 35672:return lg;case 35669:case 35673:return cg;case 5125:return hg;case 36294:return ug;case 36295:return dg;case 36296:return pg;case 35678:case 36198:case 36298:case 36306:case 35682:return fg;case 35679:case 36299:case 36307:return mg;case 35680:case 36300:case 36308:case 36293:return gg;case 36289:case 36303:case 36311:case 36292:return vg}})(t.type)}},M0=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=(function(r){switch(r){case 5126:return xg;case 35664:return yg;case 35665:return bg;case 35666:return _g;case 35674:return Mg;case 35675:return Sg;case 35676:return Tg;case 5124:case 35670:return Eg;case 35667:case 35671:return wg;case 35668:case 35672:return Ag;case 35669:case 35673:return Rg;case 5125:return Cg;case 36294:return Pg;case 36295:return Lg;case 36296:return Ig;case 35678:case 36198:case 36298:case 36306:case 35682:return Dg;case 35679:case 36299:case 36307:return Ug;case 35680:case 36300:case 36308:case 36293:return kg;case 36289:case 36303:case 36311:case 36292:return Ng}})(t.type)}},S0=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let a=0,s=r.length;a!==s;++a){let o=r[a];o.setValue(e,t[o.id],n)}}},Jc=/(\w+)(\])?(\[|\.)?/g;Wa=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let a=e.getActiveUniform(t,r);Bg(a,e.getUniformLocation(t,a.name),this)}}setValue(e,t,n,r){let a=this.map[t];a!==void 0&&a.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let a=0,s=t.length;a!==s;++a){let o=t[a],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,a=e.length;r!==a;++r){let s=e[r];s.id in t&&n.push(s)}return n}};Og=37297,zg=0;Gg=/^[ \t]*#include +<([\w\d./]+)>/gm;Vg=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);jg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;Yg=0,E0=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,n=e.fragmentShader,r=this._getShaderStage(t),a=this._getShaderStage(n),s=this._getShaderCacheForMaterial(e);return s.has(r)===!1&&(s.add(r),r.usedTimes++),s.has(a)===!1&&(s.add(a),a.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new w0(e),t.set(e,n)),n}},w0=class{constructor(e){this.id=Yg++,this.code=e,this.usedTimes=0}};e1=0;A0=class extends Un{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},R0=class extends Un{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};C0=class extends bi{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}},ht=class extends vt{constructor(){super(),this.isGroup=!0,this.type="Group"}},l1={type:"move"},Bs=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ht,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ht,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new D,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new D),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ht,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new D,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new D),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,a=null,s=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){s=!0;for(let g of e.hand.values()){let f=t.getJointPose(g,n),y=this._getHandJoint(c,g);f!==null&&(y.matrix.fromArray(f.transform.matrix),y.matrix.decompose(y.position,y.rotation,y.scale),y.matrixWorldNeedsUpdate=!0,y.jointRadius=f.radius),y.visible=f!==null}let h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],u=h.position.distanceTo(d.position),p=.02,m=.005;c.inputState.pinching&&u>p+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=p-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(a=t.getPose(e.gripSpace,n),a!==null&&(l.matrix.fromArray(a.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,a.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(a.linearVelocity)):l.hasLinearVelocity=!1,a.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(a.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&a!==null&&(r=a),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(l1)))}return o!==null&&(o.visible=r!==null),l!==null&&(l.visible=a!==null),c!==null&&(c.visible=s!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new ht;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},P0=class extends mr{constructor(e,t){super();let n=this,r=null,a=1,s=null,o="local-floor",l=1,c=null,h=null,d=null,u=null,p=null,m=null,g=t.getContextAttributes(),f=null,y=null,x=[],v=[],E=new Re,S=null,T=new bi;T.layers.enable(1),T.viewport=new pt;let C=new bi;C.layers.enable(2),C.viewport=new pt;let L=[T,C],I=new C0;I.layers.enable(1),I.layers.enable(2);let V=null,X=null;function N(Z){let te=v.indexOf(Z.inputSource);if(te===-1)return;let Ce=x[te];Ce!==void 0&&(Ce.update(Z.inputSource,Z.frame,c||s),Ce.dispatchEvent({type:Z.type,data:Z.inputSource}))}function oe(){r.removeEventListener("select",N),r.removeEventListener("selectstart",N),r.removeEventListener("selectend",N),r.removeEventListener("squeeze",N),r.removeEventListener("squeezestart",N),r.removeEventListener("squeezeend",N),r.removeEventListener("end",oe),r.removeEventListener("inputsourceschange",F);for(let Z=0;Z<x.length;Z++){let te=v[Z];te!==null&&(v[Z]=null,x[Z].disconnect(te))}V=null,X=null,e.setRenderTarget(f),p=null,u=null,d=null,r=null,y=null,se.stop(),n.isPresenting=!1,e.setPixelRatio(S),e.setSize(E.width,E.height,!1),n.dispatchEvent({type:"sessionend"})}function F(Z){for(let te=0;te<Z.removed.length;te++){let Ce=Z.removed[te],R=v.indexOf(Ce);R>=0&&(v[R]=null,x[R].disconnect(Ce))}for(let te=0;te<Z.added.length;te++){let Ce=Z.added[te],R=v.indexOf(Ce);if(R===-1){for(let K=0;K<x.length;K++){if(K>=v.length){v.push(Ce),R=K;break}if(v[K]===null){v[K]=Ce,R=K;break}}if(R===-1)break}let w=x[R];w&&w.connect(Ce)}}this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let te=x[Z];return te===void 0&&(te=new Bs,x[Z]=te),te.getTargetRaySpace()},this.getControllerGrip=function(Z){let te=x[Z];return te===void 0&&(te=new Bs,x[Z]=te),te.getGripSpace()},this.getHand=function(Z){let te=x[Z];return te===void 0&&(te=new Bs,x[Z]=te),te.getHandSpace()},this.setFramebufferScaleFactor=function(Z){a=Z,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){o=Z,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||s},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:p},this.getBinding=function(){return d},this.getFrame=function(){return m},this.getSession=function(){return r},this.setSession=async function(Z){if(r=Z,r!==null){if(f=e.getRenderTarget(),r.addEventListener("select",N),r.addEventListener("selectstart",N),r.addEventListener("selectend",N),r.addEventListener("squeeze",N),r.addEventListener("squeezestart",N),r.addEventListener("squeezeend",N),r.addEventListener("end",oe),r.addEventListener("inputsourceschange",F),g.xrCompatible!==!0&&await t.makeXRCompatible(),S=e.getPixelRatio(),e.getSize(E),r.renderState.layers===void 0||e.capabilities.isWebGL2===!1){let te={antialias:r.renderState.layers!==void 0||g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:a};p=new XRWebGLLayer(r,t,te),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),y=new _i(p.framebufferWidth,p.framebufferHeight,{format:Mn,type:Vr,colorSpace:e.outputColorSpace,stencilBuffer:g.stencil})}else{let te=null,Ce=null,R=null;g.depth&&(R=g.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,te=g.stencil?Ya:jr,Ce=g.stencil?Wr:ur);let w={colorFormat:t.RGBA8,depthFormat:R,scaleFactor:a};d=new XRWebGLBinding(r,t),u=d.createProjectionLayer(w),r.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),y=new _i(u.textureWidth,u.textureHeight,{format:Mn,type:Vr,depthTexture:new _l(u.textureWidth,u.textureHeight,Ce,void 0,void 0,void 0,void 0,void 0,void 0,te),stencilBuffer:g.stencil,colorSpace:e.outputColorSpace,samples:g.antialias?4:0}),e.properties.get(y).__ignoreDepthValues=u.ignoreDepthValues}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,s=await r.requestReferenceSpace(o),se.setContext(r),se.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode};let ne=new D,$=new D;function O(Z,te){te===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(te.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(r===null)return;I.near=C.near=T.near=Z.near,I.far=C.far=T.far=Z.far,V===I.near&&X===I.far||(r.updateRenderState({depthNear:I.near,depthFar:I.far}),V=I.near,X=I.far);let te=Z.parent,Ce=I.cameras;O(I,te);for(let R=0;R<Ce.length;R++)O(Ce[R],te);Ce.length===2?(function(R,w,K){ne.setFromMatrixPosition(w.matrixWorld),$.setFromMatrixPosition(K.matrixWorld);let W=ne.distanceTo($),U=w.projectionMatrix.elements,re=K.projectionMatrix.elements,k=U[14]/(U[10]-1),H=U[14]/(U[10]+1),ie=(U[9]+1)/U[5],ge=(U[9]-1)/U[5],pe=(U[8]-1)/U[0],b=(re[8]+1)/re[0],Q=k*pe,G=k*b,Y=W/(-pe+b),ce=Y*-pe;w.matrixWorld.decompose(R.position,R.quaternion,R.scale),R.translateX(ce),R.translateZ(Y),R.matrixWorld.compose(R.position,R.quaternion,R.scale),R.matrixWorldInverse.copy(R.matrixWorld).invert();let xe=k+Y,we=H+Y,_e=Q-ce,Ae=G+(W-ce),be=ie*H/we*xe,Te=ge*H/we*xe;R.projectionMatrix.makePerspective(_e,Ae,be,Te,xe,we),R.projectionMatrixInverse.copy(R.projectionMatrix).invert()})(I,T,C):I.projectionMatrix.copy(T.projectionMatrix),(function(R,w,K){K===null?R.matrix.copy(w.matrixWorld):(R.matrix.copy(K.matrixWorld),R.matrix.invert(),R.matrix.multiply(w.matrixWorld)),R.matrix.decompose(R.position,R.quaternion,R.scale),R.updateMatrixWorld(!0),R.projectionMatrix.copy(w.projectionMatrix),R.projectionMatrixInverse.copy(w.projectionMatrixInverse),R.isPerspectiveCamera&&(R.fov=2*Ja*Math.atan(1/R.projectionMatrix.elements[5]),R.zoom=1)})(Z,I,te)},this.getCamera=function(){return I},this.getFoveation=function(){if(u!==null||p!==null)return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Z)};let q=null,se=new xp;se.setAnimationLoop((function(Z,te){if(h=te.getViewerPose(c||s),m=te,h!==null){let Ce=h.views;p!==null&&(e.setRenderTargetFramebuffer(y,p.framebuffer),e.setRenderTarget(y));let R=!1;Ce.length!==I.cameras.length&&(I.cameras.length=0,R=!0);for(let w=0;w<Ce.length;w++){let K=Ce[w],W=null;if(p!==null)W=p.getViewport(K);else{let re=d.getViewSubImage(u,K);W=re.viewport,w===0&&(e.setRenderTargetTextures(y,re.colorTexture,u.ignoreDepthValues?void 0:re.depthStencilTexture),e.setRenderTarget(y))}let U=L[w];U===void 0&&(U=new bi,U.layers.enable(w),U.viewport=new pt,L[w]=U),U.matrix.fromArray(K.transform.matrix),U.matrix.decompose(U.position,U.quaternion,U.scale),U.projectionMatrix.fromArray(K.projectionMatrix),U.projectionMatrixInverse.copy(U.projectionMatrix).invert(),U.viewport.set(W.x,W.y,W.width,W.height),w===0&&(I.matrix.copy(U.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale)),R===!0&&I.cameras.push(U)}}for(let Ce=0;Ce<x.length;Ce++){let R=v[Ce],w=x[Ce];R!==null&&w!==void 0&&w.update(R,te,c||s)}q&&q(Z,te),te.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:te}),m=null})),this.setAnimationLoop=function(Z){q=Z},this.dispose=function(){}}};Gs=class{constructor(e={}){let{canvas:t=bm(),context:n=null,depth:r=!0,stencil:a=!0,alpha:s=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1}=e,u;this.isWebGLRenderer=!0,u=n!==null?n.getContextAttributes().alpha:s;let p=new Uint32Array(4),m=new Int32Array(4),g=null,f=null,y=[],x=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=$t,this._useLegacyLights=!1,this.toneMapping=pr,this.toneMappingExposure=1;let v=this,E=!1,S=0,T=0,C=null,L=-1,I=null,V=new pt,X=new pt,N=null,oe=new ke(0),F=0,ne=t.width,$=t.height,O=1,q=null,se=null,Z=new pt(0,0,ne,$),te=new pt(0,0,ne,$),Ce=!1,R=new es,w=!1,K=!1,W=null,U=new Ze,re=new Re,k=new D,H={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function ie(){return C===null?O:1}let ge,pe,b,Q,G,Y,ce,xe,we,_e,Ae,be,Te,Ie,ee,le,ue,Me,ze,Je,Ye,Ot,xt,Dt,ve=n;function Cn(M,z){for(let J=0;J<M.length;J++){let fe=M[J],me=t.getContext(fe,z);if(me!==null)return me}return null}try{let M={alpha:!0,depth:r,stencil:a,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine","three.js r160"),t.addEventListener("webglcontextlost",Gi,!1),t.addEventListener("webglcontextrestored",mt,!1),t.addEventListener("webglcontextcreationerror",qn,!1),ve===null){let z=["webgl2","webgl","experimental-webgl"];if(v.isWebGL1Renderer===!0&&z.shift(),ve=Cn(z,M),ve===null)throw Cn(z)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&ve instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),ve.getShaderPrecisionFormat===void 0&&(ve.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(M){throw console.error("THREE.WebGLRenderer: "+M.message),M}function Fi(){ge=new jm(ve),pe=new Fm(ve,ge,e),ge.init(pe),Ot=new o1(ve,ge,pe),b=new a1(ve,ge,pe),Q=new Ym(ve),G=new Jg,Y=new s1(ve,ge,b,G,pe,Ot,Q),ce=new Vm(v),xe=new Wm(v),we=new Bm(ve,pe),xt=new zm(ve,ge,we,pe),_e=new Xm(ve,we,Q,xt),Ae=new $m(ve,_e,we,Q),ze=new Km(ve,pe,Y),le=new Gm(G),be=new Zg(v,ce,xe,ge,pe,xt,le),Te=new c1(v,G),Ie=new $g,ee=new n1(ge,pe),Me=new Om(v,ce,xe,b,Ae,u,l),ue=new r1(v,Ae,pe),Dt=new h1(ve,Q,pe,b),Je=new Hm(ve,ge,Q,pe),Ye=new qm(ve,ge,Q,pe),Q.programs=be.programs,v.capabilities=pe,v.extensions=ge,v.properties=G,v.renderLists=Ie,v.shadowMap=ue,v.state=b,v.info=Q}Fi();let Nt=new P0(v,ve);function Gi(M){M.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),E=!0}function mt(){console.log("THREE.WebGLRenderer: Context Restored."),E=!1;let M=Q.autoReset,z=ue.enabled,J=ue.autoUpdate,fe=ue.needsUpdate,me=ue.type;Fi(),Q.autoReset=M,ue.enabled=z,ue.autoUpdate=J,ue.needsUpdate=fe,ue.type=me}function qn(M){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function _s(M){let z=M.target;z.removeEventListener("dispose",_s),(function(J){(function(fe){let me=G.get(fe).programs;me!==void 0&&(me.forEach((function(De){be.releaseProgram(De)})),fe.isShaderMaterial&&be.releaseShaderCache(fe))})(J),G.remove(J)})(z)}function ya(M,z,J){M.transparent===!0&&M.side===2&&M.forceSinglePass===!1?(M.side=di,M.needsUpdate=!0,ae(M,z,J),M.side=ni,M.needsUpdate=!0,ae(M,z,J),M.side=2):ae(M,z,J)}this.xr=Nt,this.getContext=function(){return ve},this.getContextAttributes=function(){return ve.getContextAttributes()},this.forceContextLoss=function(){let M=ge.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=ge.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return O},this.setPixelRatio=function(M){M!==void 0&&(O=M,this.setSize(ne,$,!1))},this.getSize=function(M){return M.set(ne,$)},this.setSize=function(M,z,J=!0){Nt.isPresenting?console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting."):(ne=M,$=z,t.width=Math.floor(M*O),t.height=Math.floor(z*O),J===!0&&(t.style.width=M+"px",t.style.height=z+"px"),this.setViewport(0,0,M,z))},this.getDrawingBufferSize=function(M){return M.set(ne*O,$*O).floor()},this.setDrawingBufferSize=function(M,z,J){ne=M,$=z,O=J,t.width=Math.floor(M*J),t.height=Math.floor(z*J),this.setViewport(0,0,M,z)},this.getCurrentViewport=function(M){return M.copy(V)},this.getViewport=function(M){return M.copy(Z)},this.setViewport=function(M,z,J,fe){M.isVector4?Z.set(M.x,M.y,M.z,M.w):Z.set(M,z,J,fe),b.viewport(V.copy(Z).multiplyScalar(O).floor())},this.getScissor=function(M){return M.copy(te)},this.setScissor=function(M,z,J,fe){M.isVector4?te.set(M.x,M.y,M.z,M.w):te.set(M,z,J,fe),b.scissor(X.copy(te).multiplyScalar(O).floor())},this.getScissorTest=function(){return Ce},this.setScissorTest=function(M){b.setScissorTest(Ce=M)},this.setOpaqueSort=function(M){q=M},this.setTransparentSort=function(M){se=M},this.getClearColor=function(M){return M.copy(Me.getClearColor())},this.setClearColor=function(){Me.setClearColor.apply(Me,arguments)},this.getClearAlpha=function(){return Me.getClearAlpha()},this.setClearAlpha=function(){Me.setClearAlpha.apply(Me,arguments)},this.clear=function(M=!0,z=!0,J=!0){let fe=0;if(M){let me=!1;if(C!==null){let De=C.texture.format;me=De===dp||De===up||De===hp}if(me){let De=C.texture.type,Le=De===Vr||De===ur||De===ch||De===Wr||De===lp||De===cp,Fe=Me.getClearColor(),qe=Me.getClearAlpha(),tt=Fe.r,it=Fe.g,je=Fe.b;Le?(p[0]=tt,p[1]=it,p[2]=je,p[3]=qe,ve.clearBufferuiv(ve.COLOR,0,p)):(m[0]=tt,m[1]=it,m[2]=je,m[3]=qe,ve.clearBufferiv(ve.COLOR,0,m))}else fe|=ve.COLOR_BUFFER_BIT}z&&(fe|=ve.DEPTH_BUFFER_BIT),J&&(fe|=ve.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),ve.clear(fe)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",Gi,!1),t.removeEventListener("webglcontextrestored",mt,!1),t.removeEventListener("webglcontextcreationerror",qn,!1),Ie.dispose(),ee.dispose(),G.dispose(),ce.dispose(),xe.dispose(),Ae.dispose(),xt.dispose(),Dt.dispose(),be.dispose(),Nt.dispose(),Nt.removeEventListener("sessionstart",ti),Nt.removeEventListener("sessionend",mn),W&&(W.dispose(),W=null),Vi.stop()},this.renderBufferDirect=function(M,z,J,fe,me,De){z===null&&(z=H);let Le=me.isMesh&&me.matrixWorld.determinant()<0,Fe=(function(At,yi,Kt,at,gt){yi.isScene!==!0&&(yi=H),Y.resetTextureUnits();let Ms=yi.fog,xc=at.isMeshStandardMaterial?yi.environment:null,rm=C===null?v.outputColorSpace:C.isXRRenderTarget===!0?C.texture.colorSpace:nr,_o=(at.isMeshStandardMaterial?xe:ce).get(at.envMap||xc),am=at.vertexColors===!0&&!!Kt.attributes.color&&Kt.attributes.color.itemSize===4,sm=!!Kt.attributes.tangent&&(!!at.normalMap||at.anisotropy>0),om=!!Kt.morphAttributes.position,lm=!!Kt.morphAttributes.normal,cm=!!Kt.morphAttributes.color,uu=pr;at.toneMapped&&(C!==null&&C.isXRRenderTarget!==!0||(uu=v.toneMapping));let du=Kt.morphAttributes.position||Kt.morphAttributes.normal||Kt.morphAttributes.color,hm=du!==void 0?du.length:0,Tt=G.get(at),um=f.state.lights;if(w===!0&&(K===!0||At!==I)){let en=At===I&&at.id===L;le.setState(at,At,en)}let gn=!1;at.version===Tt.__version?Tt.needsLights&&Tt.lightsStateVersion!==um.state.version||Tt.outputColorSpace!==rm||gt.isBatchedMesh&&Tt.batching===!1?gn=!0:gt.isBatchedMesh||Tt.batching!==!0?gt.isInstancedMesh&&Tt.instancing===!1?gn=!0:gt.isInstancedMesh||Tt.instancing!==!0?gt.isSkinnedMesh&&Tt.skinning===!1?gn=!0:gt.isSkinnedMesh||Tt.skinning!==!0?gt.isInstancedMesh&&Tt.instancingColor===!0&&gt.instanceColor===null||gt.isInstancedMesh&&Tt.instancingColor===!1&&gt.instanceColor!==null||Tt.envMap!==_o||at.fog===!0&&Tt.fog!==Ms?gn=!0:Tt.numClippingPlanes===void 0||Tt.numClippingPlanes===le.numPlanes&&Tt.numIntersection===le.numIntersection?(Tt.vertexAlphas!==am||Tt.vertexTangents!==sm||Tt.morphTargets!==om||Tt.morphNormals!==lm||Tt.morphColors!==cm||Tt.toneMapping!==uu||pe.isWebGL2===!0&&Tt.morphTargetsCount!==hm)&&(gn=!0):gn=!0:gn=!0:gn=!0:gn=!0:(gn=!0,Tt.__version=at.version);let Dr=Tt.currentProgram;gn===!0&&(Dr=ae(at,yi,gt));let pu=!1,Ss=!1,yc=!1,Si=Dr.getUniforms(),Ur=Tt.uniforms;if(b.useProgram(Dr.program)&&(pu=!0,Ss=!0,yc=!0),at.id!==L&&(L=at.id,Ss=!0),pu||I!==At){Si.setValue(ve,"projectionMatrix",At.projectionMatrix),Si.setValue(ve,"viewMatrix",At.matrixWorldInverse);let en=Si.map.cameraPosition;en!==void 0&&en.setValue(ve,k.setFromMatrixPosition(At.matrixWorld)),pe.logarithmicDepthBuffer&&Si.setValue(ve,"logDepthBufFC",2/(Math.log(At.far+1)/Math.LN2)),(at.isMeshPhongMaterial||at.isMeshToonMaterial||at.isMeshLambertMaterial||at.isMeshBasicMaterial||at.isMeshStandardMaterial||at.isShaderMaterial)&&Si.setValue(ve,"isOrthographic",At.isOrthographicCamera===!0),I!==At&&(I=At,Ss=!0,yc=!0)}if(gt.isSkinnedMesh){Si.setOptional(ve,gt,"bindMatrix"),Si.setOptional(ve,gt,"bindMatrixInverse");let en=gt.skeleton;en&&(pe.floatVertexTextures?(en.boneTexture===null&&en.computeBoneTexture(),Si.setValue(ve,"boneTexture",en.boneTexture,Y)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}gt.isBatchedMesh&&(Si.setOptional(ve,gt,"batchingTexture"),Si.setValue(ve,"batchingTexture",gt._matricesTexture,Y));let bc=Kt.morphAttributes;(bc.position!==void 0||bc.normal!==void 0||bc.color!==void 0&&pe.isWebGL2===!0)&&ze.update(gt,Kt,Dr),(Ss||Tt.receiveShadow!==gt.receiveShadow)&&(Tt.receiveShadow=gt.receiveShadow,Si.setValue(ve,"receiveShadow",gt.receiveShadow)),at.isMeshGouraudMaterial&&at.envMap!==null&&(Ur.envMap.value=_o,Ur.flipEnvMap.value=_o.isCubeTexture&&_o.isRenderTargetTexture===!1?-1:1),Ss&&(Si.setValue(ve,"toneMappingExposure",v.toneMappingExposure),Tt.needsLights&&(vn=yc,(Pn=Ur).ambientLightColor.needsUpdate=vn,Pn.lightProbe.needsUpdate=vn,Pn.directionalLights.needsUpdate=vn,Pn.directionalLightShadows.needsUpdate=vn,Pn.pointLights.needsUpdate=vn,Pn.pointLightShadows.needsUpdate=vn,Pn.spotLights.needsUpdate=vn,Pn.spotLightShadows.needsUpdate=vn,Pn.rectAreaLights.needsUpdate=vn,Pn.hemisphereLights.needsUpdate=vn),Ms&&at.fog===!0&&Te.refreshFogUniforms(Ur,Ms),Te.refreshMaterialUniforms(Ur,at,O,$,W),Wa.upload(ve,de(Tt),Ur,Y));var Pn,vn;if(at.isShaderMaterial&&at.uniformsNeedUpdate===!0&&(Wa.upload(ve,de(Tt),Ur,Y),at.uniformsNeedUpdate=!1),at.isSpriteMaterial&&Si.setValue(ve,"center",gt.center),Si.setValue(ve,"modelViewMatrix",gt.modelViewMatrix),Si.setValue(ve,"normalMatrix",gt.normalMatrix),Si.setValue(ve,"modelMatrix",gt.matrixWorld),at.isShaderMaterial||at.isRawShaderMaterial){let en=at.uniformsGroups;for(let _c=0,dm=en.length;_c<dm;_c++)if(pe.isWebGL2){let fu=en[_c];Dt.update(fu,Dr),Dt.bind(fu,Dr)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return Dr})(M,z,J,fe,me);b.setMaterial(fe,Le);let qe=J.index,tt=1;if(fe.wireframe===!0){if(qe=_e.getWireframeAttribute(J),qe===void 0)return;tt=2}let it=J.drawRange,je=J.attributes.position,st=it.start*tt,Jt=(it.start+it.count)*tt;De!==null&&(st=Math.max(st,De.start*tt),Jt=Math.min(Jt,(De.start+De.count)*tt)),qe!==null?(st=Math.max(st,0),Jt=Math.min(Jt,qe.count)):je!=null&&(st=Math.max(st,0),Jt=Math.min(Jt,je.count));let Ht=Jt-st;if(Ht<0||Ht===1/0)return;let et;xt.setup(me,fe,Fe,J,qe);let rt=Je;if(qe!==null&&(et=we.get(qe),rt=Ye,rt.setIndex(et)),me.isMesh)fe.wireframe===!0?(b.setLineWidth(fe.wireframeLinewidth*ie()),rt.setMode(ve.LINES)):rt.setMode(ve.TRIANGLES);else if(me.isLine){let At=fe.linewidth;At===void 0&&(At=1),b.setLineWidth(At*ie()),me.isLineSegments?rt.setMode(ve.LINES):me.isLineLoop?rt.setMode(ve.LINE_LOOP):rt.setMode(ve.LINE_STRIP)}else me.isPoints?rt.setMode(ve.POINTS):me.isSprite&&rt.setMode(ve.TRIANGLES);if(me.isBatchedMesh)rt.renderMultiDraw(me._multiDrawStarts,me._multiDrawCounts,me._multiDrawCount);else if(me.isInstancedMesh)rt.renderInstances(st,Ht,me.count);else if(J.isInstancedBufferGeometry){let At=J._maxInstanceCount!==void 0?J._maxInstanceCount:1/0,yi=Math.min(J.instanceCount,At);rt.renderInstances(st,Ht,yi)}else rt.render(st,Ht)},this.compile=function(M,z,J=null){J===null&&(J=M),f=ee.get(J),f.init(),x.push(f),J.traverseVisible((function(me){me.isLight&&me.layers.test(z.layers)&&(f.pushLight(me),me.castShadow&&f.pushShadow(me))})),M!==J&&M.traverseVisible((function(me){me.isLight&&me.layers.test(z.layers)&&(f.pushLight(me),me.castShadow&&f.pushShadow(me))})),f.setupLights(v._useLegacyLights);let fe=new Set;return M.traverse((function(me){let De=me.material;if(De)if(Array.isArray(De))for(let Le=0;Le<De.length;Le++){let Fe=De[Le];ya(Fe,J,me),fe.add(Fe)}else ya(De,J,me),fe.add(De)})),x.pop(),f=null,fe},this.compileAsync=function(M,z,J=null){let fe=this.compile(M,z,J);return new Promise((me=>{function De(){fe.forEach((function(Le){G.get(Le).currentProgram.isReady()&&fe.delete(Le)})),fe.size!==0?setTimeout(De,10):me(M)}ge.get("KHR_parallel_shader_compile")!==null?De():setTimeout(De,10)}))};let Ir=null;function ti(){Vi.stop()}function mn(){Vi.start()}let Vi=new xp;function bo(M,z,J,fe){if(M.visible===!1)return;if(M.layers.test(z.layers)){if(M.isGroup)J=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(z);else if(M.isLight)f.pushLight(M),M.castShadow&&f.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||R.intersectsSprite(M)){fe&&k.setFromMatrixPosition(M.matrixWorld).applyMatrix4(U);let De=Ae.update(M),Le=M.material;Le.visible&&g.push(M,De,Le,J,k.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||R.intersectsObject(M))){let De=Ae.update(M),Le=M.material;if(fe&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),k.copy(M.boundingSphere.center)):(De.boundingSphere===null&&De.computeBoundingSphere(),k.copy(De.boundingSphere.center)),k.applyMatrix4(M.matrixWorld).applyMatrix4(U)),Array.isArray(Le)){let Fe=De.groups;for(let qe=0,tt=Fe.length;qe<tt;qe++){let it=Fe[qe],je=Le[it.materialIndex];je&&je.visible&&g.push(M,De,je,J,k.z,it)}}else Le.visible&&g.push(M,De,Le,J,k.z,null)}}let me=M.children;for(let De=0,Le=me.length;De<Le;De++)bo(me[De],z,J,fe)}function _(M,z,J,fe){let me=M.opaque,De=M.transmissive,Le=M.transparent;f.setupLightsView(J),w===!0&&le.setGlobalState(v.clippingPlanes,J),De.length>0&&(function(Fe,qe,tt,it){if((tt.isScene===!0?tt.overrideMaterial:null)!==null)return;let st=pe.isWebGL2;W===null&&(W=new _i(1,1,{generateMipmaps:!0,type:ge.has("EXT_color_buffer_half_float")?qi:Vr,minFilter:al,samples:st?4:0})),v.getDrawingBufferSize(re),st?W.setSize(re.x,re.y):W.setSize(dl(re.x),dl(re.y));let Jt=v.getRenderTarget();v.setRenderTarget(W),v.getClearColor(oe),F=v.getClearAlpha(),F<1&&v.setClearColor(16777215,.5),v.clear();let Ht=v.toneMapping;v.toneMapping=pr,A(Fe,tt,it),Y.updateMultisampleRenderTarget(W),Y.updateRenderTargetMipmap(W);let et=!1;for(let rt=0,At=qe.length;rt<At;rt++){let yi=qe[rt],Kt=yi.object,at=yi.geometry,gt=yi.material,Ms=yi.group;if(gt.side===2&&Kt.layers.test(it.layers)){let xc=gt.side;gt.side=di,gt.needsUpdate=!0,B(Kt,tt,it,at,gt,Ms),gt.side=xc,gt.needsUpdate=!0,et=!0}}et===!0&&(Y.updateMultisampleRenderTarget(W),Y.updateRenderTargetMipmap(W)),v.setRenderTarget(Jt),v.setClearColor(oe,F),v.toneMapping=Ht})(me,De,z,J),fe&&b.viewport(V.copy(fe)),me.length>0&&A(me,z,J),De.length>0&&A(De,z,J),Le.length>0&&A(Le,z,J),b.buffers.depth.setTest(!0),b.buffers.depth.setMask(!0),b.buffers.color.setMask(!0),b.setPolygonOffset(!1)}function A(M,z,J){let fe=z.isScene===!0?z.overrideMaterial:null;for(let me=0,De=M.length;me<De;me++){let Le=M[me],Fe=Le.object,qe=Le.geometry,tt=fe===null?Le.material:fe,it=Le.group;Fe.layers.test(J.layers)&&B(Fe,z,J,qe,tt,it)}}function B(M,z,J,fe,me,De){M.onBeforeRender(v,z,J,fe,me,De),M.modelViewMatrix.multiplyMatrices(J.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),me.onBeforeRender(v,z,J,fe,M,De),me.transparent===!0&&me.side===2&&me.forceSinglePass===!1?(me.side=di,me.needsUpdate=!0,v.renderBufferDirect(J,z,fe,me,M,De),me.side=ni,me.needsUpdate=!0,v.renderBufferDirect(J,z,fe,me,M,De),me.side=2):v.renderBufferDirect(J,z,fe,me,M,De),M.onAfterRender(v,z,J,fe,me,De)}function ae(M,z,J){z.isScene!==!0&&(z=H);let fe=G.get(M),me=f.state.lights,De=f.state.shadowsArray,Le=me.state.version,Fe=be.getParameters(M,me.state,De,z,J),qe=be.getProgramCacheKey(Fe),tt=fe.programs;fe.environment=M.isMeshStandardMaterial?z.environment:null,fe.fog=z.fog,fe.envMap=(M.isMeshStandardMaterial?xe:ce).get(M.envMap||fe.environment),tt===void 0&&(M.addEventListener("dispose",_s),tt=new Map,fe.programs=tt);let it=tt.get(qe);if(it!==void 0){if(fe.currentProgram===it&&fe.lightsStateVersion===Le)return ye(M,Fe),it}else Fe.uniforms=be.getUniforms(M),M.onBuild(J,Fe,v),M.onBeforeCompile(Fe,v),it=be.acquireProgram(Fe,qe),tt.set(qe,it),fe.uniforms=Fe.uniforms;let je=fe.uniforms;return(M.isShaderMaterial||M.isRawShaderMaterial)&&M.clipping!==!0||(je.clippingPlanes=le.uniform),ye(M,Fe),fe.needsLights=(function(st){return st.isMeshLambertMaterial||st.isMeshToonMaterial||st.isMeshPhongMaterial||st.isMeshStandardMaterial||st.isShadowMaterial||st.isShaderMaterial&&st.lights===!0})(M),fe.lightsStateVersion=Le,fe.needsLights&&(je.ambientLightColor.value=me.state.ambient,je.lightProbe.value=me.state.probe,je.directionalLights.value=me.state.directional,je.directionalLightShadows.value=me.state.directionalShadow,je.spotLights.value=me.state.spot,je.spotLightShadows.value=me.state.spotShadow,je.rectAreaLights.value=me.state.rectArea,je.ltc_1.value=me.state.rectAreaLTC1,je.ltc_2.value=me.state.rectAreaLTC2,je.pointLights.value=me.state.point,je.pointLightShadows.value=me.state.pointShadow,je.hemisphereLights.value=me.state.hemi,je.directionalShadowMap.value=me.state.directionalShadowMap,je.directionalShadowMatrix.value=me.state.directionalShadowMatrix,je.spotShadowMap.value=me.state.spotShadowMap,je.spotLightMatrix.value=me.state.spotLightMatrix,je.spotLightMap.value=me.state.spotLightMap,je.pointShadowMap.value=me.state.pointShadowMap,je.pointShadowMatrix.value=me.state.pointShadowMatrix),fe.currentProgram=it,fe.uniformsList=null,it}function de(M){if(M.uniformsList===null){let z=M.currentProgram.getUniforms();M.uniformsList=Wa.seqWithValue(z.seq,M.uniforms)}return M.uniformsList}function ye(M,z){let J=G.get(M);J.outputColorSpace=z.outputColorSpace,J.batching=z.batching,J.instancing=z.instancing,J.instancingColor=z.instancingColor,J.skinning=z.skinning,J.morphTargets=z.morphTargets,J.morphNormals=z.morphNormals,J.morphColors=z.morphColors,J.morphTargetsCount=z.morphTargetsCount,J.numClippingPlanes=z.numClippingPlanes,J.numIntersection=z.numClipIntersection,J.vertexAlphas=z.vertexAlphas,J.vertexTangents=z.vertexTangents,J.toneMapping=z.toneMapping}Vi.setAnimationLoop((function(M){Ir&&Ir(M)})),typeof self<"u"&&Vi.setContext(self),this.setAnimationLoop=function(M){Ir=M,Nt.setAnimationLoop(M),M===null?Vi.stop():Vi.start()},Nt.addEventListener("sessionstart",ti),Nt.addEventListener("sessionend",mn),this.render=function(M,z){if(z!==void 0&&z.isCamera!==!0)return void console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");if(E===!0)return;M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),z.parent===null&&z.matrixWorldAutoUpdate===!0&&z.updateMatrixWorld(),Nt.enabled===!0&&Nt.isPresenting===!0&&(Nt.cameraAutoUpdate===!0&&Nt.updateCamera(z),z=Nt.getCamera()),M.isScene===!0&&M.onBeforeRender(v,M,z,C),f=ee.get(M,x.length),f.init(),x.push(f),U.multiplyMatrices(z.projectionMatrix,z.matrixWorldInverse),R.setFromProjectionMatrix(U),K=this.localClippingEnabled,w=le.init(this.clippingPlanes,K),g=Ie.get(M,y.length),g.init(),y.push(g),bo(M,z,0,v.sortObjects),g.finish(),v.sortObjects===!0&&g.sort(q,se),this.info.render.frame++,w===!0&&le.beginShadows();let J=f.state.shadowsArray;if(ue.render(J,M,z),w===!0&&le.endShadows(),this.info.autoReset===!0&&this.info.reset(),Me.render(g,M),f.setupLights(v._useLegacyLights),z.isArrayCamera){let fe=z.cameras;for(let me=0,De=fe.length;me<De;me++){let Le=fe[me];_(g,M,Le,Le.viewport)}}else _(g,M,z);C!==null&&(Y.updateMultisampleRenderTarget(C),Y.updateRenderTargetMipmap(C)),M.isScene===!0&&M.onAfterRender(v,M,z),xt.resetDefaultState(),L=-1,I=null,x.pop(),f=x.length>0?x[x.length-1]:null,y.pop(),g=y.length>0?y[y.length-1]:null},this.getActiveCubeFace=function(){return S},this.getActiveMipmapLevel=function(){return T},this.getRenderTarget=function(){return C},this.setRenderTargetTextures=function(M,z,J){G.get(M.texture).__webglTexture=z,G.get(M.depthTexture).__webglTexture=J;let fe=G.get(M);fe.__hasExternalTextures=!0,fe.__hasExternalTextures&&(fe.__autoAllocateDepthBuffer=J===void 0,fe.__autoAllocateDepthBuffer||ge.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),fe.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(M,z){let J=G.get(M);J.__webglFramebuffer=z,J.__useDefaultFramebuffer=z===void 0},this.setRenderTarget=function(M,z=0,J=0){C=M,S=z,T=J;let fe=!0,me=null,De=!1,Le=!1;if(M){let Fe=G.get(M);Fe.__useDefaultFramebuffer!==void 0?(b.bindFramebuffer(ve.FRAMEBUFFER,null),fe=!1):Fe.__webglFramebuffer===void 0?Y.setupRenderTarget(M):Fe.__hasExternalTextures&&Y.rebindTextures(M,G.get(M.texture).__webglTexture,G.get(M.depthTexture).__webglTexture);let qe=M.texture;(qe.isData3DTexture||qe.isDataArrayTexture||qe.isCompressedArrayTexture)&&(Le=!0);let tt=G.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(me=Array.isArray(tt[z])?tt[z][J]:tt[z],De=!0):me=pe.isWebGL2&&M.samples>0&&Y.useMultisampledRTT(M)===!1?G.get(M).__webglMultisampledFramebuffer:Array.isArray(tt)?tt[J]:tt,V.copy(M.viewport),X.copy(M.scissor),N=M.scissorTest}else V.copy(Z).multiplyScalar(O).floor(),X.copy(te).multiplyScalar(O).floor(),N=Ce;if(b.bindFramebuffer(ve.FRAMEBUFFER,me)&&pe.drawBuffers&&fe&&b.drawBuffers(M,me),b.viewport(V),b.scissor(X),b.setScissorTest(N),De){let Fe=G.get(M.texture);ve.framebufferTexture2D(ve.FRAMEBUFFER,ve.COLOR_ATTACHMENT0,ve.TEXTURE_CUBE_MAP_POSITIVE_X+z,Fe.__webglTexture,J)}else if(Le){let Fe=G.get(M.texture),qe=z||0;ve.framebufferTextureLayer(ve.FRAMEBUFFER,ve.COLOR_ATTACHMENT0,Fe.__webglTexture,J||0,qe)}L=-1},this.readRenderTargetPixels=function(M,z,J,fe,me,De,Le){if(!M||!M.isWebGLRenderTarget)return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Fe=G.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Le!==void 0&&(Fe=Fe[Le]),Fe){b.bindFramebuffer(ve.FRAMEBUFFER,Fe);try{let qe=M.texture,tt=qe.format,it=qe.type;if(tt!==Mn&&Ot.convert(tt)!==ve.getParameter(ve.IMPLEMENTATION_COLOR_READ_FORMAT))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");let je=it===qi&&(ge.has("EXT_color_buffer_half_float")||pe.isWebGL2&&ge.has("EXT_color_buffer_float"));if(!(it===Vr||Ot.convert(it)===ve.getParameter(ve.IMPLEMENTATION_COLOR_READ_TYPE)||it===ir&&(pe.isWebGL2||ge.has("OES_texture_float")||ge.has("WEBGL_color_buffer_float"))||je))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");z>=0&&z<=M.width-fe&&J>=0&&J<=M.height-me&&ve.readPixels(z,J,fe,me,Ot.convert(tt),Ot.convert(it),De)}finally{let qe=C!==null?G.get(C).__webglFramebuffer:null;b.bindFramebuffer(ve.FRAMEBUFFER,qe)}}},this.copyFramebufferToTexture=function(M,z,J=0){let fe=Math.pow(2,-J),me=Math.floor(z.image.width*fe),De=Math.floor(z.image.height*fe);Y.setTexture2D(z,0),ve.copyTexSubImage2D(ve.TEXTURE_2D,J,0,0,M.x,M.y,me,De),b.unbindTexture()},this.copyTextureToTexture=function(M,z,J,fe=0){let me=z.image.width,De=z.image.height,Le=Ot.convert(J.format),Fe=Ot.convert(J.type);Y.setTexture2D(J,0),ve.pixelStorei(ve.UNPACK_FLIP_Y_WEBGL,J.flipY),ve.pixelStorei(ve.UNPACK_PREMULTIPLY_ALPHA_WEBGL,J.premultiplyAlpha),ve.pixelStorei(ve.UNPACK_ALIGNMENT,J.unpackAlignment),z.isDataTexture?ve.texSubImage2D(ve.TEXTURE_2D,fe,M.x,M.y,me,De,Le,Fe,z.image.data):z.isCompressedTexture?ve.compressedTexSubImage2D(ve.TEXTURE_2D,fe,M.x,M.y,z.mipmaps[0].width,z.mipmaps[0].height,Le,z.mipmaps[0].data):ve.texSubImage2D(ve.TEXTURE_2D,fe,M.x,M.y,Le,Fe,z.image),fe===0&&J.generateMipmaps&&ve.generateMipmap(ve.TEXTURE_2D),b.unbindTexture()},this.copyTextureToTexture3D=function(M,z,J,fe,me=0){if(v.isWebGL1Renderer)return void console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");let De=M.max.x-M.min.x+1,Le=M.max.y-M.min.y+1,Fe=M.max.z-M.min.z+1,qe=Ot.convert(fe.format),tt=Ot.convert(fe.type),it;if(fe.isData3DTexture)Y.setTexture3D(fe,0),it=ve.TEXTURE_3D;else{if(!fe.isDataArrayTexture&&!fe.isCompressedArrayTexture)return void console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");Y.setTexture2DArray(fe,0),it=ve.TEXTURE_2D_ARRAY}ve.pixelStorei(ve.UNPACK_FLIP_Y_WEBGL,fe.flipY),ve.pixelStorei(ve.UNPACK_PREMULTIPLY_ALPHA_WEBGL,fe.premultiplyAlpha),ve.pixelStorei(ve.UNPACK_ALIGNMENT,fe.unpackAlignment);let je=ve.getParameter(ve.UNPACK_ROW_LENGTH),st=ve.getParameter(ve.UNPACK_IMAGE_HEIGHT),Jt=ve.getParameter(ve.UNPACK_SKIP_PIXELS),Ht=ve.getParameter(ve.UNPACK_SKIP_ROWS),et=ve.getParameter(ve.UNPACK_SKIP_IMAGES),rt=J.isCompressedTexture?J.mipmaps[me]:J.image;ve.pixelStorei(ve.UNPACK_ROW_LENGTH,rt.width),ve.pixelStorei(ve.UNPACK_IMAGE_HEIGHT,rt.height),ve.pixelStorei(ve.UNPACK_SKIP_PIXELS,M.min.x),ve.pixelStorei(ve.UNPACK_SKIP_ROWS,M.min.y),ve.pixelStorei(ve.UNPACK_SKIP_IMAGES,M.min.z),J.isDataTexture||J.isData3DTexture?ve.texSubImage3D(it,me,z.x,z.y,z.z,De,Le,Fe,qe,tt,rt.data):J.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),ve.compressedTexSubImage3D(it,me,z.x,z.y,z.z,De,Le,Fe,qe,rt.data)):ve.texSubImage3D(it,me,z.x,z.y,z.z,De,Le,Fe,qe,tt,rt),ve.pixelStorei(ve.UNPACK_ROW_LENGTH,je),ve.pixelStorei(ve.UNPACK_IMAGE_HEIGHT,st),ve.pixelStorei(ve.UNPACK_SKIP_PIXELS,Jt),ve.pixelStorei(ve.UNPACK_SKIP_ROWS,Ht),ve.pixelStorei(ve.UNPACK_SKIP_IMAGES,et),me===0&&fe.generateMipmaps&&ve.generateMipmap(it),b.unbindTexture()},this.initTexture=function(M){M.isCubeTexture?Y.setTextureCube(M,0):M.isData3DTexture?Y.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?Y.setTexture2DArray(M,0):Y.setTexture2D(M,0),b.unbindTexture()},this.resetState=function(){S=0,T=0,C=null,b.reset(),xt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Za}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=e===uh?"display-p3":"srgb",t.unpackColorSpace=Rt.workingColorSpace===Nl?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===$t?Xr:fp}set outputEncoding(e){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=e===Xr?$t:nr}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(e){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=e}},L0=class extends Gs{};L0.prototype.isWebGL1Renderer=!0;Ml=class i{constructor(e,t=1,n=1e3){this.isFog=!0,this.name="",this.color=new ke(e),this.near=t,this.far=n}clone(){return new i(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},Vs=class extends vt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t}},Sl=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=p0,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.version=0,this.uuid=Sn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let r=0,a=this.stride;r<a;r++)this.array[e+r]=t.array[n+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Sn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Sn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},Ci=new D,Ws=class i{constructor(e,t,n,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Ci.fromBufferAttribute(this,t),Ci.applyMatrix4(e),this.setXYZ(t,Ci.x,Ci.y,Ci.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ci.fromBufferAttribute(this,t),Ci.applyNormalMatrix(e),this.setXYZ(t,Ci.x,Ci.y,Ci.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ci.fromBufferAttribute(this,t),Ci.transformDirection(e),this.setXYZ(t,Ci.x,Ci.y,Ci.z);return this}setX(e,t){return this.normalized&&(t=It(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=It(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=It(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=It(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=Dn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=Dn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=Dn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=Dn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=It(t,this.array),n=It(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=It(t,this.array),n=It(n,this.array),r=It(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this}setXYZW(e,t,n,r,a){return e=e*this.data.stride+this.offset,this.normalized&&(t=It(t,this.array),n=It(n,this.array),r=It(r,this.array),a=It(a,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this.data.array[e+3]=a,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let r=n*this.data.stride+this.offset;for(let a=0;a<this.itemSize;a++)t.push(this.data.array[r+a])}return new jt(new this.array.constructor(t),this.itemSize,this.normalized)}return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new i(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let r=n*this.data.stride+this.offset;for(let a=0;a<this.itemSize;a++)t.push(this.data.array[r+a])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},an=class extends Un{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new ke(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Cs=new D,Ba=new D,Oa=new D,za=new Re,Ps=new Re,Tp=new Ze,Wo=new D,Ls=new D,jo=new D,Pd=new Re,Kc=new Re,Ld=new Re,En=class extends vt{constructor(e=new an){if(super(),this.isSprite=!0,this.type="Sprite",Na===void 0){Na=new ut;let t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Sl(t,5);Na.setIndex([0,1,2,0,2,3]),Na.setAttribute("position",new Ws(n,3,0,!1)),Na.setAttribute("uv",new Ws(n,2,3,!1))}this.geometry=Na,this.material=e,this.center=new Re(.5,.5)}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Ba.setFromMatrixScale(this.matrixWorld),Tp.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Oa.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Ba.multiplyScalar(-Oa.z);let n=this.material.rotation,r,a;n!==0&&(a=Math.cos(n),r=Math.sin(n));let s=this.center;Xo(Wo.set(-.5,-.5,0),Oa,s,Ba,r,a),Xo(Ls.set(.5,-.5,0),Oa,s,Ba,r,a),Xo(jo.set(.5,.5,0),Oa,s,Ba,r,a),Pd.set(0,0),Kc.set(1,0),Ld.set(1,1);let o=e.ray.intersectTriangle(Wo,Ls,jo,!1,Cs);if(o===null&&(Xo(Ls.set(-.5,.5,0),Oa,s,Ba,r,a),Kc.set(0,1),o=e.ray.intersectTriangle(Wo,jo,Ls,!1,Cs),o===null))return;let l=e.ray.origin.distanceTo(Cs);l<e.near||l>e.far||t.push({distance:l,point:Cs.clone(),uv:dr.getInterpolation(Cs,Wo,Ls,jo,Pd,Kc,Ld,new Re),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}};bx=new D,_x=new D,Id=new D,Dd=new pt,Ud=new pt,u1=new D,kd=new Ze,qo=new D,$c=new rn,Nd=new Ze,Qc=new Ka,vr=class extends yt{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=mu,this.bindMatrix=new Ze,this.bindMatrixInverse=new Ze,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new nn),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,qo),this.boundingBox.expandByPoint(qo)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new rn),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,qo),this.boundingSphere.expandByPoint(qo)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let n=this.material,r=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),$c.copy(this.boundingSphere),$c.applyMatrix4(r),e.ray.intersectsSphere($c)!==!1&&(Nd.copy(r).invert(),Qc.copy(e.ray).applyMatrix4(Nd),this.boundingBox!==null&&Qc.intersectsBox(this.boundingBox)===!1||this._computeIntersections(e,t,Qc)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new pt,t=this.geometry.attributes.skinWeight;for(let n=0,r=t.count;n<r;n++){e.fromBufferAttribute(t,n);let a=1/e.manhattanLength();a!==1/0?e.multiplyScalar(a):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===mu?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===xm?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,r=this.geometry;Dd.fromBufferAttribute(r.attributes.skinIndex,e),Ud.fromBufferAttribute(r.attributes.skinWeight,e),Id.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let a=0;a<4;a++){let s=Ud.getComponent(a);if(s!==0){let o=Dd.getComponent(a);kd.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),t.addScaledVector(u1.copy(Id).applyMatrix4(kd),s)}}return t.applyMatrix4(this.bindMatrixInverse)}boneTransform(e,t){return console.warn("THREE.SkinnedMesh: .boneTransform() was renamed to .applyBoneTransform() in r151."),this.applyBoneTransform(e,t)}},ts=class extends vt{constructor(){super(),this.isBone=!0,this.type="Bone"}},qr=class extends Xi{constructor(e=null,t=1,n=1,r,a,s,o,l,c=1003,h=1003,d,u){super(null,s,o,l,c,h,r,a,d,u),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Bd=new Ze,d1=new Ze,js=class i{constructor(e=[],t=[]){this.uuid=Sn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(16*e.length),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,r=this.bones.length;n<r;n++)this.boneInverses.push(new Ze)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let n=new Ze;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,r=this.boneTexture;for(let a=0,s=e.length;a<s;a++){let o=e[a]?e[a].matrixWorld:d1;Bd.multiplyMatrices(o,t[a]),Bd.toArray(n,16*a)}r!==null&&(r.needsUpdate=!0)}clone(){return new i(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(4*this.bones.length);e=4*Math.ceil(e/4),e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new qr(t,e,e,Mn,ir);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,r=e.bones.length;n<r;n++){let a=e.bones[n],s=t[a];s===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",a),s=new ts),this.bones.push(s),this.boneInverses.push(new Ze().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let r=0,a=t.length;r<a;r++){let s=t[r];e.bones.push(s.uuid);let o=n[r];e.boneInverses.push(o.toArray())}return e}},Xs=class extends jt{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Ha=new Ze,Od=new Ze,Yo=[],zd=new nn,p1=new Ze,Is=new yt,Ds=new rn,Yr=class extends yt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Xs(new Float32Array(16*n),16),this.instanceColor=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<n;r++)this.setMatrixAt(r,p1)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new nn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ha),zd.copy(e.boundingBox).applyMatrix4(Ha),this.boundingBox.union(zd)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new rn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ha),Ds.copy(e.boundingSphere).applyMatrix4(Ha),this.boundingSphere.union(Ds)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,3*e)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,16*e)}raycast(e,t){let n=this.matrixWorld,r=this.count;if(Is.geometry=this.geometry,Is.material=this.material,Is.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Ds.copy(this.boundingSphere),Ds.applyMatrix4(n),e.ray.intersectsSphere(Ds)!==!1))for(let a=0;a<r;a++){this.getMatrixAt(a,Ha),Od.multiplyMatrices(n,Ha),Is.matrixWorld=Od,Is.raycast(e,Yo);for(let s=0,o=Yo.length;s<o;s++){let l=Yo[s];l.instanceId=a,l.object=this,t.push(l)}Yo.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Xs(new Float32Array(3*this.instanceMatrix.count),3)),t.toArray(this.instanceColor.array,3*e)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,16*e)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}},I0=class{constructor(){this.index=0,this.pool=[],this.list=[]}push(e,t){let n=this.pool,r=this.list;this.index>=n.length&&n.push({start:-1,count:-1,z:-1});let a=n[this.index];r.push(a),this.index++,a.start=e.start,a.count=e.count,a.z=t}reset(){this.list.length=0,this.index=0}},Mx=new Ze,Sx=new Ze,Tx=new Ze,Ex=new Ze,wx=new es,Ax=new nn,Rx=new rn,Cx=new D,Px=new I0,Lx=new yt,Zr=class extends Un{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ke(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Hd=new D,Fd=new D,Gd=new Ze,e0=new Ka,Zo=new rn,is=class extends vt{constructor(e=new ut,t=new Zr){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let r=1,a=t.count;r<a;r++)Hd.fromBufferAttribute(t,r-1),Fd.fromBufferAttribute(t,r),n[r]=n[r-1],n[r]+=Hd.distanceTo(Fd);e.setAttribute("lineDistance",new He(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let n=this.geometry,r=this.matrixWorld,a=e.params.Line.threshold,s=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Zo.copy(n.boundingSphere),Zo.applyMatrix4(r),Zo.radius+=a,e.ray.intersectsSphere(Zo)===!1)return;Gd.copy(r).invert(),e0.copy(e.ray).applyMatrix4(Gd);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=new D,h=new D,d=new D,u=new D,p=this.isLineSegments?2:1,m=n.index,g=n.attributes.position;if(m!==null)for(let f=Math.max(0,s.start),y=Math.min(m.count,s.start+s.count)-1;f<y;f+=p){let x=m.getX(f),v=m.getX(f+1);if(c.fromBufferAttribute(g,x),h.fromBufferAttribute(g,v),e0.distanceSqToSegment(c,h,u,d)>l)continue;u.applyMatrix4(this.matrixWorld);let E=e.ray.origin.distanceTo(u);E<e.near||E>e.far||t.push({distance:E,point:d.clone().applyMatrix4(this.matrixWorld),index:f,face:null,faceIndex:null,object:this})}else for(let f=Math.max(0,s.start),y=Math.min(g.count,s.start+s.count)-1;f<y;f+=p){if(c.fromBufferAttribute(g,f),h.fromBufferAttribute(g,f+1),e0.distanceSqToSegment(c,h,u,d)>l)continue;u.applyMatrix4(this.matrixWorld);let x=e.ray.origin.distanceTo(u);x<e.near||x>e.far||t.push({distance:x,point:d.clone().applyMatrix4(this.matrixWorld),index:f,face:null,faceIndex:null,object:this})}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){let s=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=r}}}}},Vd=new D,Wd=new D,Tl=class extends is{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let r=0,a=t.count;r<a;r+=2)Vd.fromBufferAttribute(t,r),Wd.fromBufferAttribute(t,r+1),n[r]=r===0?0:n[r-1],n[r+1]=n[r]+Vd.distanceTo(Wd);e.setAttribute("lineDistance",new He(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},qs=class extends Un{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ke(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},jd=new Ze,D0=new Ka,Jo=new rn,Ko=new D,Ys=class extends vt{constructor(e=new ut,t=new qs){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,r=this.matrixWorld,a=e.params.Points.threshold,s=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Jo.copy(n.boundingSphere),Jo.applyMatrix4(r),Jo.radius+=a,e.ray.intersectsSphere(Jo)===!1)return;jd.copy(r).invert(),D0.copy(e.ray).applyMatrix4(jd);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,h=n.attributes.position;if(c!==null)for(let d=Math.max(0,s.start),u=Math.min(c.count,s.start+s.count);d<u;d++){let p=c.getX(d);Ko.fromBufferAttribute(h,p),Xd(Ko,p,l,r,e,t,this)}else for(let d=Math.max(0,s.start),u=Math.min(h.count,s.start+s.count);d<u;d++)Ko.fromBufferAttribute(h,d),Xd(Ko,d,l,r,e,t,this)}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){let s=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=r}}}}};Jr=class extends Xi{constructor(e,t,n,r,a,s,o,l,c){super(e,t,n,r,a,s,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},sn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,r=this.getPoint(0),a=0;t.push(0);for(let s=1;s<=e;s++)n=this.getPoint(s/e),a+=n.distanceTo(r),t.push(a),r=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){let n=this.getLengths(),r=0,a=n.length,s;s=t||e*n[a-1];let o,l=0,c=a-1;for(;l<=c;)if(r=Math.floor(l+(c-l)/2),o=n[r]-s,o<0)l=r+1;else{if(!(o>0)){c=r;break}c=r-1}if(r=c,n[r]===s)return r/(a-1);let h=n[r];return(r+(s-h)/(n[r+1]-h))/(a-1)}getTangent(e,t){let r=e-1e-4,a=e+1e-4;r<0&&(r=0),a>1&&(a=1);let s=this.getPoint(r),o=this.getPoint(a),l=t||(s.isVector2?new Re:new D);return l.copy(o).sub(s).normalize(),l}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){let n=new D,r=[],a=[],s=[],o=new D,l=new Ze;for(let p=0;p<=e;p++){let m=p/e;r[p]=this.getTangentAt(m,new D)}a[0]=new D,s[0]=new D;let c=Number.MAX_VALUE,h=Math.abs(r[0].x),d=Math.abs(r[0].y),u=Math.abs(r[0].z);h<=c&&(c=h,n.set(1,0,0)),d<=c&&(c=d,n.set(0,1,0)),u<=c&&n.set(0,0,1),o.crossVectors(r[0],n).normalize(),a[0].crossVectors(r[0],o),s[0].crossVectors(r[0],a[0]);for(let p=1;p<=e;p++){if(a[p]=a[p-1].clone(),s[p]=s[p-1].clone(),o.crossVectors(r[p-1],r[p]),o.length()>Number.EPSILON){o.normalize();let m=Math.acos(ui(r[p-1].dot(r[p]),-1,1));a[p].applyMatrix4(l.makeRotationAxis(o,m))}s[p].crossVectors(r[p],a[p])}if(t===!0){let p=Math.acos(ui(a[0].dot(a[e]),-1,1));p/=e,r[0].dot(o.crossVectors(a[0],a[e]))>0&&(p=-p);for(let m=1;m<=e;m++)a[m].applyMatrix4(l.makeRotationAxis(r[m],p*m)),s[m].crossVectors(r[m],a[m])}return{tangents:r,normals:a,binormals:s}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},Zs=class extends sn{constructor(e=0,t=0,n=1,r=1,a=0,s=2*Math.PI,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=r,this.aStartAngle=a,this.aEndAngle=s,this.aClockwise=o,this.aRotation=l}getPoint(e,t){let n=t||new Re,r=2*Math.PI,a=this.aEndAngle-this.aStartAngle,s=Math.abs(a)<Number.EPSILON;for(;a<0;)a+=r;for(;a>r;)a-=r;a<Number.EPSILON&&(a=s?0:r),this.aClockwise!==!0||s||(a===r?a=-r:a-=r);let o=this.aStartAngle+e*a,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=l-this.aX,p=c-this.aY;l=u*h-p*d+this.aX,c=u*d+p*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},U0=class extends Zs{constructor(e,t,n,r,a,s){super(e,t,n,n,r,a,s),this.isArcCurve=!0,this.type="ArcCurve"}};$o=new D,t0=new fh,i0=new fh,n0=new fh,wi=class extends sn{constructor(e=[],t=!1,n="centripetal",r=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=r}getPoint(e,t=new D){let n=t,r=this.points,a=r.length,s=(a-(this.closed?0:1))*e,o,l,c=Math.floor(s),h=s-c;this.closed?c+=c>0?0:(Math.floor(Math.abs(c)/a)+1)*a:h===0&&c===a-1&&(c=a-2,h=1),this.closed||c>0?o=r[(c-1)%a]:($o.subVectors(r[0],r[1]).add(r[0]),o=$o);let d=r[c%a],u=r[(c+1)%a];if(this.closed||c+2<a?l=r[(c+2)%a]:($o.subVectors(r[a-1],r[a-2]).add(r[a-1]),l=$o),this.curveType==="centripetal"||this.curveType==="chordal"){let p=this.curveType==="chordal"?.5:.25,m=Math.pow(o.distanceToSquared(d),p),g=Math.pow(d.distanceToSquared(u),p),f=Math.pow(u.distanceToSquared(l),p);g<1e-4&&(g=1),m<1e-4&&(m=g),f<1e-4&&(f=g),t0.initNonuniformCatmullRom(o.x,d.x,u.x,l.x,m,g,f),i0.initNonuniformCatmullRom(o.y,d.y,u.y,l.y,m,g,f),n0.initNonuniformCatmullRom(o.z,d.z,u.z,l.z,m,g,f)}else this.curveType==="catmullrom"&&(t0.initCatmullRom(o.x,d.x,u.x,l.x,this.tension),i0.initCatmullRom(o.y,d.y,u.y,l.y,this.tension),n0.initCatmullRom(o.z,d.z,u.z,l.z,this.tension));return n.set(t0.calc(h),i0.calc(h),n0.calc(h)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(r.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let r=this.points[t];e.points.push(r.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(new D().fromArray(r))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};El=class extends sn{constructor(e=new Re,t=new Re,n=new Re,r=new Re){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new Re){let n=t,r=this.v0,a=this.v1,s=this.v2,o=this.v3;return n.set(zs(e,r.x,a.x,s.x,o.x),zs(e,r.y,a.y,s.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},k0=class extends sn{constructor(e=new D,t=new D,n=new D,r=new D){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new D){let n=t,r=this.v0,a=this.v1,s=this.v2,o=this.v3;return n.set(zs(e,r.x,a.x,s.x,o.x),zs(e,r.y,a.y,s.y,o.y),zs(e,r.z,a.z,s.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},wl=class extends sn{constructor(e=new Re,t=new Re){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new Re){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new Re){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},N0=class extends sn{constructor(e=new D,t=new D){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new D){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new D){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Al=class extends sn{constructor(e=new Re,t=new Re,n=new Re){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new Re){let n=t,r=this.v0,a=this.v1,s=this.v2;return n.set(Os(e,r.x,a.x,s.x),Os(e,r.y,a.y,s.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Rl=class extends sn{constructor(e=new D,t=new D,n=new D){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new D){let n=t,r=this.v0,a=this.v1,s=this.v2;return n.set(Os(e,r.x,a.x,s.x),Os(e,r.y,a.y,s.y),Os(e,r.z,a.z,s.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Cl=class extends sn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new Re){let n=t,r=this.points,a=(r.length-1)*e,s=Math.floor(a),o=a-s,l=r[s===0?s:s-1],c=r[s],h=r[s>r.length-2?r.length-1:s+1],d=r[s>r.length-3?r.length-1:s+2];return n.set(qd(o,l.x,c.x,h.x,d.x),qd(o,l.y,c.y,h.y,d.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(r.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let r=this.points[t];e.points.push(r.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(new Re().fromArray(r))}return this}},Pl=Object.freeze({__proto__:null,ArcCurve:U0,CatmullRomCurve3:wi,CubicBezierCurve:El,CubicBezierCurve3:k0,EllipseCurve:Zs,LineCurve:wl,LineCurve3:N0,QuadraticBezierCurve:Al,QuadraticBezierCurve3:Rl,SplineCurve:Cl}),B0=class extends sn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Pl[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),r=this.getCurveLengths(),a=0;for(;a<r.length;){if(r[a]>=n){let s=r[a]-n,o=this.curves[a],l=o.getLength(),c=l===0?0:1-s/l;return o.getPointAt(c,t)}a++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,r=this.curves.length;n<r;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let r=0,a=this.curves;r<a.length;r++){let s=a[r],o=s.isEllipseCurve?2*e:s.isLineCurve||s.isLineCurve3?1:s.isSplineCurve?e*s.points.length:e,l=s.getPoints(o);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let r=e.curves[t];this.curves.push(r.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let r=this.curves[t];e.curves.push(r.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let r=e.curves[t];this.curves.push(new Pl[r.type]().fromJSON(r))}return this}},Js=class extends B0{constructor(e){super(),this.type="Path",this.currentPoint=new Re,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new wl(this.currentPoint.clone(),new Re(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,r){let a=new Al(this.currentPoint.clone(),new Re(e,t),new Re(n,r));return this.curves.push(a),this.currentPoint.set(n,r),this}bezierCurveTo(e,t,n,r,a,s){let o=new El(this.currentPoint.clone(),new Re(e,t),new Re(n,r),new Re(a,s));return this.curves.push(o),this.currentPoint.set(a,s),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new Cl(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,r,a,s){let o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+o,t+l,n,r,a,s),this}absarc(e,t,n,r,a,s){return this.absellipse(e,t,n,n,r,a,s),this}ellipse(e,t,n,r,a,s,o,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,n,r,a,s,o,l),this}absellipse(e,t,n,r,a,s,o,l){let c=new Zs(e,t,n,r,a,s,o,l);if(this.curves.length>0){let d=c.getPoint(0);d.equals(this.currentPoint)||this.lineTo(d.x,d.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},Ks=class i extends ut{constructor(e=[new Re(0,-.5),new Re(.5,0),new Re(0,.5)],t=12,n=0,r=2*Math.PI){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:r},t=Math.floor(t),r=ui(r,0,2*Math.PI);let a=[],s=[],o=[],l=[],c=[],h=1/t,d=new D,u=new Re,p=new D,m=new D,g=new D,f=0,y=0;for(let x=0;x<=e.length-1;x++)switch(x){case 0:f=e[x+1].x-e[x].x,y=e[x+1].y-e[x].y,p.x=1*y,p.y=-f,p.z=0*y,g.copy(p),p.normalize(),l.push(p.x,p.y,p.z);break;case e.length-1:l.push(g.x,g.y,g.z);break;default:f=e[x+1].x-e[x].x,y=e[x+1].y-e[x].y,p.x=1*y,p.y=-f,p.z=0*y,m.copy(p),p.x+=g.x,p.y+=g.y,p.z+=g.z,p.normalize(),l.push(p.x,p.y,p.z),g.copy(m)}for(let x=0;x<=t;x++){let v=n+x*h*r,E=Math.sin(v),S=Math.cos(v);for(let T=0;T<=e.length-1;T++){d.x=e[T].x*E,d.y=e[T].y,d.z=e[T].x*S,s.push(d.x,d.y,d.z),u.x=x/t,u.y=T/(e.length-1),o.push(u.x,u.y);let C=l[3*T+0]*E,L=l[3*T+1],I=l[3*T+0]*S;c.push(C,L,I)}}for(let x=0;x<t;x++)for(let v=0;v<e.length-1;v++){let E=v+x*e.length,S=E,T=E+e.length,C=E+e.length+1,L=E+1;a.push(S,T,L),a.push(C,L,T)}this.setIndex(a),this.setAttribute("position",new He(s,3)),this.setAttribute("uv",new He(o,2)),this.setAttribute("normal",new He(c,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.points,e.segments,e.phiStart,e.phiLength)}},Kr=class i extends Ks{constructor(e=1,t=1,n=4,r=8){let a=new Js;a.absarc(0,-t/2,e,1.5*Math.PI,0),a.absarc(0,t/2,e,0,.5*Math.PI),super(a.getPoints(n),r),this.type="CapsuleGeometry",this.parameters={radius:e,length:t,capSegments:n,radialSegments:r}}static fromJSON(e){return new i(e.radius,e.length,e.capSegments,e.radialSegments)}},$r=class i extends ut{constructor(e=1,t=32,n=0,r=2*Math.PI){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:r},t=Math.max(3,t);let a=[],s=[],o=[],l=[],c=new D,h=new Re;s.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let d=0,u=3;d<=t;d++,u+=3){let p=n+d/t*r;c.x=e*Math.cos(p),c.y=e*Math.sin(p),s.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(s[u]/e+1)/2,h.y=(s[u+1]/e+1)/2,l.push(h.x,h.y)}for(let d=1;d<=t;d++)a.push(d,d+1,0);this.setIndex(a),this.setAttribute("position",new He(s,3)),this.setAttribute("normal",new He(o,3)),this.setAttribute("uv",new He(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.segments,e.thetaStart,e.thetaLength)}},Ke=class i extends ut{constructor(e=1,t=1,n=1,r=32,a=1,s=!1,o=0,l=2*Math.PI){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:r,heightSegments:a,openEnded:s,thetaStart:o,thetaLength:l};let c=this;r=Math.floor(r),a=Math.floor(a);let h=[],d=[],u=[],p=[],m=0,g=[],f=n/2,y=0;function x(v){let E=m,S=new Re,T=new D,C=0,L=v===!0?e:t,I=v===!0?1:-1;for(let X=1;X<=r;X++)d.push(0,f*I,0),u.push(0,I,0),p.push(.5,.5),m++;let V=m;for(let X=0;X<=r;X++){let N=X/r*l+o,oe=Math.cos(N),F=Math.sin(N);T.x=L*F,T.y=f*I,T.z=L*oe,d.push(T.x,T.y,T.z),u.push(0,I,0),S.x=.5*oe+.5,S.y=.5*F*I+.5,p.push(S.x,S.y),m++}for(let X=0;X<r;X++){let N=E+X,oe=V+X;v===!0?h.push(oe,oe+1,N):h.push(oe+1,oe,N),C+=3}c.addGroup(y,C,v===!0?1:2),y+=C}(function(){let v=new D,E=new D,S=0,T=(t-e)/n;for(let C=0;C<=a;C++){let L=[],I=C/a,V=I*(t-e)+e;for(let X=0;X<=r;X++){let N=X/r,oe=N*l+o,F=Math.sin(oe),ne=Math.cos(oe);E.x=V*F,E.y=-I*n+f,E.z=V*ne,d.push(E.x,E.y,E.z),v.set(F,T,ne).normalize(),u.push(v.x,v.y,v.z),p.push(N,1-I),L.push(m++)}g.push(L)}for(let C=0;C<r;C++)for(let L=0;L<a;L++){let I=g[L][C],V=g[L+1][C],X=g[L+1][C+1],N=g[L][C+1];h.push(I,V,N),h.push(V,X,N),S+=6}c.addGroup(y,S,0),y+=S})(),s===!1&&(e>0&&x(!0),t>0&&x(!1)),this.setIndex(h),this.setAttribute("position",new He(d,3)),this.setAttribute("normal",new He(u,3)),this.setAttribute("uv",new He(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Qt=class i extends Ke{constructor(e=1,t=1,n=32,r=1,a=!1,s=0,o=2*Math.PI){super(0,e,t,n,r,a,s,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:r,openEnded:a,thetaStart:s,thetaLength:o}}static fromJSON(e){return new i(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Qr=class i extends ut{constructor(e=[],t=[],n=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:r};let a=[],s=[];function o(u,p,m,g){let f=g+1,y=[];for(let x=0;x<=f;x++){y[x]=[];let v=u.clone().lerp(m,x/f),E=p.clone().lerp(m,x/f),S=f-x;for(let T=0;T<=S;T++)y[x][T]=T===0&&x===f?v:v.clone().lerp(E,T/S)}for(let x=0;x<f;x++)for(let v=0;v<2*(f-x)-1;v++){let E=Math.floor(v/2);v%2==0?(l(y[x][E+1]),l(y[x+1][E]),l(y[x][E])):(l(y[x][E+1]),l(y[x+1][E+1]),l(y[x+1][E]))}}function l(u){a.push(u.x,u.y,u.z)}function c(u,p){let m=3*u;p.x=e[m+0],p.y=e[m+1],p.z=e[m+2]}function h(u,p,m,g){g<0&&u.x===1&&(s[p]=u.x-1),m.x===0&&m.z===0&&(s[p]=g/2/Math.PI+.5)}function d(u){return Math.atan2(u.z,-u.x)}(function(u){let p=new D,m=new D,g=new D;for(let f=0;f<t.length;f+=3)c(t[f+0],p),c(t[f+1],m),c(t[f+2],g),o(p,m,g,u)})(r),(function(u){let p=new D;for(let m=0;m<a.length;m+=3)p.x=a[m+0],p.y=a[m+1],p.z=a[m+2],p.normalize().multiplyScalar(u),a[m+0]=p.x,a[m+1]=p.y,a[m+2]=p.z})(n),(function(){let u=new D;for(let m=0;m<a.length;m+=3){u.x=a[m+0],u.y=a[m+1],u.z=a[m+2];let g=d(u)/2/Math.PI+.5,f=(p=u,Math.atan2(-p.y,Math.sqrt(p.x*p.x+p.z*p.z))/Math.PI+.5);s.push(g,1-f)}var p;(function(){let m=new D,g=new D,f=new D,y=new D,x=new Re,v=new Re,E=new Re;for(let S=0,T=0;S<a.length;S+=9,T+=6){m.set(a[S+0],a[S+1],a[S+2]),g.set(a[S+3],a[S+4],a[S+5]),f.set(a[S+6],a[S+7],a[S+8]),x.set(s[T+0],s[T+1]),v.set(s[T+2],s[T+3]),E.set(s[T+4],s[T+5]),y.copy(m).add(g).add(f).divideScalar(3);let C=d(y);h(x,T+0,m,C),h(v,T+2,g,C),h(E,T+4,f,C)}})(),(function(){for(let m=0;m<s.length;m+=6){let g=s[m+0],f=s[m+2],y=s[m+4],x=Math.max(g,f,y),v=Math.min(g,f,y);x>.9&&v<.1&&(g<.2&&(s[m+0]+=1),f<.2&&(s[m+2]+=1),y<.2&&(s[m+4]+=1))}})()})(),this.setAttribute("position",new He(a,3)),this.setAttribute("normal",new He(a.slice(),3)),this.setAttribute("uv",new He(s,2)),r===0?this.computeVertexNormals():this.normalizeNormals()}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.vertices,e.indices,e.radius,e.details)}},$s=class i extends Qr{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,r=1/n;super([-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-r,-n,0,-r,n,0,r,-n,0,r,n,-r,-n,0,-r,n,0,r,-n,0,r,n,0,-n,0,-r,n,0,-r,-n,0,r,n,0,r],[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9],e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},Qo=new D,el=new D,r0=new D,tl=new dr,O0=class extends ut{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){let r=Math.pow(10,4),a=Math.cos(Ga*t),s=e.getIndex(),o=e.getAttribute("position"),l=s?s.count:o.count,c=[0,0,0],h=["a","b","c"],d=new Array(3),u={},p=[];for(let m=0;m<l;m+=3){s?(c[0]=s.getX(m),c[1]=s.getX(m+1),c[2]=s.getX(m+2)):(c[0]=m,c[1]=m+1,c[2]=m+2);let{a:g,b:f,c:y}=tl;if(g.fromBufferAttribute(o,c[0]),f.fromBufferAttribute(o,c[1]),y.fromBufferAttribute(o,c[2]),tl.getNormal(r0),d[0]=`${Math.round(g.x*r)},${Math.round(g.y*r)},${Math.round(g.z*r)}`,d[1]=`${Math.round(f.x*r)},${Math.round(f.y*r)},${Math.round(f.z*r)}`,d[2]=`${Math.round(y.x*r)},${Math.round(y.y*r)},${Math.round(y.z*r)}`,d[0]!==d[1]&&d[1]!==d[2]&&d[2]!==d[0])for(let x=0;x<3;x++){let v=(x+1)%3,E=d[x],S=d[v],T=tl[h[x]],C=tl[h[v]],L=`${E}_${S}`,I=`${S}_${E}`;I in u&&u[I]?(r0.dot(u[I].normal)<=a&&(p.push(T.x,T.y,T.z),p.push(C.x,C.y,C.z)),u[I]=null):L in u||(u[L]={index0:c[x],index1:c[v],normal:r0.clone()})}}for(let m in u)if(u[m]){let{index0:g,index1:f}=u[m];Qo.fromBufferAttribute(o,g),el.fromBufferAttribute(o,f),p.push(Qo.x,Qo.y,Qo.z),p.push(el.x,el.y,el.z)}this.setAttribute("position",new He(p,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}},ns=class extends Js{constructor(e){super(e),this.uuid=Sn(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,r=this.holes.length;n<r;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let r=e.holes[t];this.holes.push(r.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let r=this.holes[t];e.holes.push(r.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let r=e.holes[t];this.holes.push(new Js().fromJSON(r))}return this}},f1=function(i,e,t=2){let n=e&&e.length,r=n?e[0]*t:i.length,a=Yd(i,0,r,t,!0),s=[];if(!a||a.next===a.prev)return s;let o,l,c,h,d,u,p;if(n&&(a=(function(m,g,f,y){let x=[],v,E,S,T,C;for(v=0,E=g.length;v<E;v++)S=g[v]*y,T=v<E-1?g[v+1]*y:m.length,C=Yd(m,S,T,y,!1),C===C.next&&(C.steiner=!0),x.push(M1(C));for(x.sort(y1),v=0;v<x.length;v++)f=b1(x[v],f);return f})(i,e,a,t)),i.length>80*t){o=c=i[0],l=h=i[1];for(let m=t;m<r;m+=t)d=i[m],u=i[m+1],d<o&&(o=d),u<l&&(l=u),d>c&&(c=d),u>h&&(h=u);p=Math.max(c-o,h-l),p=p!==0?32767/p:0}return Qs(a,s,t,o,l,p,0),s};fr=class i{static area(e){let t=e.length,n=0;for(let r=t-1,a=0;a<t;r=a++)n+=e[r].x*e[a].y-e[a].x*e[r].y;return .5*n}static isClockWise(e){return i.area(e)<0}static triangulateShape(e,t){let n=[],r=[],a=[];Jd(e),Kd(n,e);let s=e.length;t.forEach(Jd);for(let l=0;l<t.length;l++)r.push(s),s+=t[l].length,Kd(n,t[l]);let o=f1(n,r);for(let l=0;l<o.length;l+=3)a.push(o.slice(l,l+3));return a}};ri=class i extends ut{constructor(e=new ns([new Re(.5,.5),new Re(-.5,.5),new Re(-.5,-.5),new Re(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,r=[],a=[];for(let o=0,l=e.length;o<l;o++)s(e[o]);function s(o){let l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,d=t.depth!==void 0?t.depth:1,u=t.bevelEnabled===void 0||t.bevelEnabled,p=t.bevelThickness!==void 0?t.bevelThickness:.2,m=t.bevelSize!==void 0?t.bevelSize:p-.1,g=t.bevelOffset!==void 0?t.bevelOffset:0,f=t.bevelSegments!==void 0?t.bevelSegments:3,y=t.extrudePath,x=t.UVGenerator!==void 0?t.UVGenerator:T1,v,E,S,T,C,L=!1;y&&(v=y.getSpacedPoints(h),L=!0,u=!1,E=y.computeFrenetFrames(h,!1),S=new D,T=new D,C=new D),u||(f=0,p=0,m=0,g=0);let I=o.extractPoints(c),V=I.shape,X=I.holes;if(!fr.isClockWise(V)){V=V.reverse();for(let k=0,H=X.length;k<H;k++){let ie=X[k];fr.isClockWise(ie)&&(X[k]=ie.reverse())}}let N=fr.triangulateShape(V,X),oe=V;for(let k=0,H=X.length;k<H;k++){let ie=X[k];V=V.concat(ie)}function F(k,H,ie){return H||console.error("THREE.ExtrudeGeometry: vec does not exist"),k.clone().addScaledVector(H,ie)}let ne=V.length,$=N.length;function O(k,H,ie){let ge,pe,b,Q=k.x-H.x,G=k.y-H.y,Y=ie.x-k.x,ce=ie.y-k.y,xe=Q*Q+G*G,we=Q*ce-G*Y;if(Math.abs(we)>Number.EPSILON){let _e=Math.sqrt(xe),Ae=Math.sqrt(Y*Y+ce*ce),be=H.x-G/_e,Te=H.y+Q/_e,Ie=((ie.x-ce/Ae-be)*ce-(ie.y+Y/Ae-Te)*Y)/(Q*ce-G*Y);ge=be+Q*Ie-k.x,pe=Te+G*Ie-k.y;let ee=ge*ge+pe*pe;if(ee<=2)return new Re(ge,pe);b=Math.sqrt(ee/2)}else{let _e=!1;Q>Number.EPSILON?Y>Number.EPSILON&&(_e=!0):Q<-Number.EPSILON?Y<-Number.EPSILON&&(_e=!0):Math.sign(G)===Math.sign(ce)&&(_e=!0),_e?(ge=-G,pe=Q,b=Math.sqrt(xe)):(ge=Q,pe=G,b=Math.sqrt(xe/2))}return new Re(ge/b,pe/b)}let q=[];for(let k=0,H=oe.length,ie=H-1,ge=k+1;k<H;k++,ie++,ge++)ie===H&&(ie=0),ge===H&&(ge=0),q[k]=O(oe[k],oe[ie],oe[ge]);let se=[],Z,te=q.concat();for(let k=0,H=X.length;k<H;k++){let ie=X[k];Z=[];for(let ge=0,pe=ie.length,b=pe-1,Q=ge+1;ge<pe;ge++,b++,Q++)b===pe&&(b=0),Q===pe&&(Q=0),Z[ge]=O(ie[ge],ie[b],ie[Q]);se.push(Z),te=te.concat(Z)}for(let k=0;k<f;k++){let H=k/f,ie=p*Math.cos(H*Math.PI/2),ge=m*Math.sin(H*Math.PI/2)+g;for(let pe=0,b=oe.length;pe<b;pe++){let Q=F(oe[pe],q[pe],ge);w(Q.x,Q.y,-ie)}for(let pe=0,b=X.length;pe<b;pe++){let Q=X[pe];Z=se[pe];for(let G=0,Y=Q.length;G<Y;G++){let ce=F(Q[G],Z[G],ge);w(ce.x,ce.y,-ie)}}}let Ce=m+g;for(let k=0;k<ne;k++){let H=u?F(V[k],te[k],Ce):V[k];L?(T.copy(E.normals[0]).multiplyScalar(H.x),S.copy(E.binormals[0]).multiplyScalar(H.y),C.copy(v[0]).add(T).add(S),w(C.x,C.y,C.z)):w(H.x,H.y,0)}for(let k=1;k<=h;k++)for(let H=0;H<ne;H++){let ie=u?F(V[H],te[H],Ce):V[H];L?(T.copy(E.normals[k]).multiplyScalar(ie.x),S.copy(E.binormals[k]).multiplyScalar(ie.y),C.copy(v[k]).add(T).add(S),w(C.x,C.y,C.z)):w(ie.x,ie.y,d/h*k)}for(let k=f-1;k>=0;k--){let H=k/f,ie=p*Math.cos(H*Math.PI/2),ge=m*Math.sin(H*Math.PI/2)+g;for(let pe=0,b=oe.length;pe<b;pe++){let Q=F(oe[pe],q[pe],ge);w(Q.x,Q.y,d+ie)}for(let pe=0,b=X.length;pe<b;pe++){let Q=X[pe];Z=se[pe];for(let G=0,Y=Q.length;G<Y;G++){let ce=F(Q[G],Z[G],ge);L?w(ce.x,ce.y+v[h-1].y,v[h-1].x+ie):w(ce.x,ce.y,d+ie)}}}function R(k,H){let ie=k.length;for(;--ie>=0;){let ge=ie,pe=ie-1;pe<0&&(pe=k.length-1);for(let b=0,Q=h+2*f;b<Q;b++){let G=ne*b,Y=ne*(b+1);W(H+ge+G,H+pe+G,H+pe+Y,H+ge+Y)}}}function w(k,H,ie){l.push(k),l.push(H),l.push(ie)}function K(k,H,ie){U(k),U(H),U(ie);let ge=r.length/3,pe=x.generateTopUV(n,r,ge-3,ge-2,ge-1);re(pe[0]),re(pe[1]),re(pe[2])}function W(k,H,ie,ge){U(k),U(H),U(ge),U(H),U(ie),U(ge);let pe=r.length/3,b=x.generateSideWallUV(n,r,pe-6,pe-3,pe-2,pe-1);re(b[0]),re(b[1]),re(b[3]),re(b[1]),re(b[2]),re(b[3])}function U(k){r.push(l[3*k+0]),r.push(l[3*k+1]),r.push(l[3*k+2])}function re(k){a.push(k.x),a.push(k.y)}(function(){let k=r.length/3;if(u){let H=0,ie=ne*H;for(let ge=0;ge<$;ge++){let pe=N[ge];K(pe[2]+ie,pe[1]+ie,pe[0]+ie)}H=h+2*f,ie=ne*H;for(let ge=0;ge<$;ge++){let pe=N[ge];K(pe[0]+ie,pe[1]+ie,pe[2]+ie)}}else{for(let H=0;H<$;H++){let ie=N[H];K(ie[2],ie[1],ie[0])}for(let H=0;H<$;H++){let ie=N[H];K(ie[0]+ne*h,ie[1]+ne*h,ie[2]+ne*h)}}n.addGroup(k,r.length/3-k,0)})(),(function(){let k=r.length/3,H=0;R(oe,H),H+=oe.length;for(let ie=0,ge=X.length;ie<ge;ie++){let pe=X[ie];R(pe,H),H+=pe.length}n.addGroup(k,r.length/3-k,1)})()}this.setAttribute("position",new He(r,3)),this.setAttribute("uv",new He(a,2)),this.computeVertexNormals()}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return(function(t,n,r){if(r.shapes=[],Array.isArray(t))for(let a=0,s=t.length;a<s;a++){let o=t[a];r.shapes.push(o.uuid)}else r.shapes.push(t.uuid);return r.options=Object.assign({},n),n.extrudePath!==void 0&&(r.options.extrudePath=n.extrudePath.toJSON()),r})(this.parameters.shapes,this.parameters.options,e)}static fromJSON(e,t){let n=[];for(let a=0,s=e.shapes.length;a<s;a++){let o=t[e.shapes[a]];n.push(o)}let r=e.options.extrudePath;return r!==void 0&&(e.options.extrudePath=new Pl[r.type]().fromJSON(r)),new i(n,e.options)}},T1={generateTopUV:function(i,e,t,n,r){let a=e[3*t],s=e[3*t+1],o=e[3*n],l=e[3*n+1],c=e[3*r],h=e[3*r+1];return[new Re(a,s),new Re(o,l),new Re(c,h)]},generateSideWallUV:function(i,e,t,n,r,a){let s=e[3*t],o=e[3*t+1],l=e[3*t+2],c=e[3*n],h=e[3*n+1],d=e[3*n+2],u=e[3*r],p=e[3*r+1],m=e[3*r+2],g=e[3*a],f=e[3*a+1],y=e[3*a+2];return Math.abs(o-h)<Math.abs(s-c)?[new Re(s,1-l),new Re(c,1-d),new Re(u,1-m),new Re(g,1-y)]:[new Re(o,1-l),new Re(h,1-d),new Re(p,1-m),new Re(f,1-y)]}},ta=class i extends Qr{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2;super([-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1],e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},rs=class i extends Qr{constructor(e=1,t=0){super([1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2],e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},F0=class i extends ut{constructor(e=.5,t=1,n=32,r=1,a=0,s=2*Math.PI){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:r,thetaStart:a,thetaLength:s},n=Math.max(3,n);let o=[],l=[],c=[],h=[],d=e,u=(t-e)/(r=Math.max(1,r)),p=new D,m=new Re;for(let g=0;g<=r;g++){for(let f=0;f<=n;f++){let y=a+f/n*s;p.x=d*Math.cos(y),p.y=d*Math.sin(y),l.push(p.x,p.y,p.z),c.push(0,0,1),m.x=(p.x/t+1)/2,m.y=(p.y/t+1)/2,h.push(m.x,m.y)}d+=u}for(let g=0;g<r;g++){let f=g*(n+1);for(let y=0;y<n;y++){let x=y+f,v=x,E=x+n+1,S=x+n+2,T=x+1;o.push(v,E,T),o.push(E,S,T)}}this.setIndex(o),this.setAttribute("position",new He(l,3)),this.setAttribute("normal",new He(c,3)),this.setAttribute("uv",new He(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}},G0=class i extends ut{constructor(e=new ns([new Re(0,.5),new Re(-.5,-.5),new Re(.5,-.5)]),t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};let n=[],r=[],a=[],s=[],o=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let h=0;h<e.length;h++)c(e[h]),this.addGroup(o,l,h),o+=l,l=0;function c(h){let d=r.length/3,u=h.extractPoints(t),p=u.shape,m=u.holes;fr.isClockWise(p)===!1&&(p=p.reverse());for(let f=0,y=m.length;f<y;f++){let x=m[f];fr.isClockWise(x)===!0&&(m[f]=x.reverse())}let g=fr.triangulateShape(p,m);for(let f=0,y=m.length;f<y;f++){let x=m[f];p=p.concat(x)}for(let f=0,y=p.length;f<y;f++){let x=p[f];r.push(x.x,x.y,0),a.push(0,0,1),s.push(x.x,x.y)}for(let f=0,y=g.length;f<y;f++){let x=g[f],v=x[0]+d,E=x[1]+d,S=x[2]+d;n.push(v,E,S),l+=3}}this.setIndex(n),this.setAttribute("position",new He(r,3)),this.setAttribute("normal",new He(a,3)),this.setAttribute("uv",new He(s,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return(function(t,n){if(n.shapes=[],Array.isArray(t))for(let r=0,a=t.length;r<a;r++){let s=t[r];n.shapes.push(s.uuid)}else n.shapes.push(t.uuid);return n})(this.parameters.shapes,e)}static fromJSON(e,t){let n=[];for(let r=0,a=e.shapes.length;r<a;r++){let s=t[e.shapes[r]];n.push(s)}return new i(n,e.curveSegments)}},bt=class i extends ut{constructor(e=1,t=32,n=16,r=0,a=2*Math.PI,s=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:r,phiLength:a,thetaStart:s,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let l=Math.min(s+o,Math.PI),c=0,h=[],d=new D,u=new D,p=[],m=[],g=[],f=[];for(let y=0;y<=n;y++){let x=[],v=y/n,E=0;y===0&&s===0?E=.5/t:y===n&&l===Math.PI&&(E=-.5/t);for(let S=0;S<=t;S++){let T=S/t;d.x=-e*Math.cos(r+T*a)*Math.sin(s+v*o),d.y=e*Math.cos(s+v*o),d.z=e*Math.sin(r+T*a)*Math.sin(s+v*o),m.push(d.x,d.y,d.z),u.copy(d).normalize(),g.push(u.x,u.y,u.z),f.push(T+E,1-v),x.push(c++)}h.push(x)}for(let y=0;y<n;y++)for(let x=0;x<t;x++){let v=h[y][x+1],E=h[y][x],S=h[y+1][x],T=h[y+1][x+1];(y!==0||s>0)&&p.push(v,E,T),(y!==n-1||l<Math.PI)&&p.push(E,S,T)}this.setIndex(p),this.setAttribute("position",new He(m,3)),this.setAttribute("normal",new He(g,3)),this.setAttribute("uv",new He(f,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}},V0=class i extends Qr{constructor(e=1,t=0){super([1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],[2,1,0,0,3,2,1,3,0,2,3,1],e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},wt=class i extends ut{constructor(e=1,t=.4,n=12,r=48,a=2*Math.PI){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:r,arc:a},n=Math.floor(n),r=Math.floor(r);let s=[],o=[],l=[],c=[],h=new D,d=new D,u=new D;for(let p=0;p<=n;p++)for(let m=0;m<=r;m++){let g=m/r*a,f=p/n*Math.PI*2;d.x=(e+t*Math.cos(f))*Math.cos(g),d.y=(e+t*Math.cos(f))*Math.sin(g),d.z=t*Math.sin(f),o.push(d.x,d.y,d.z),h.x=e*Math.cos(g),h.y=e*Math.sin(g),u.subVectors(d,h).normalize(),l.push(u.x,u.y,u.z),c.push(m/r),c.push(p/n)}for(let p=1;p<=n;p++)for(let m=1;m<=r;m++){let g=(r+1)*p+m-1,f=(r+1)*(p-1)+m-1,y=(r+1)*(p-1)+m,x=(r+1)*p+m;s.push(g,f,x),s.push(f,y,x)}this.setIndex(s),this.setAttribute("position",new He(o,3)),this.setAttribute("normal",new He(l,3)),this.setAttribute("uv",new He(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}},W0=class i extends ut{constructor(e=1,t=.4,n=64,r=8,a=2,s=3){super(),this.type="TorusKnotGeometry",this.parameters={radius:e,tube:t,tubularSegments:n,radialSegments:r,p:a,q:s},n=Math.floor(n),r=Math.floor(r);let o=[],l=[],c=[],h=[],d=new D,u=new D,p=new D,m=new D,g=new D,f=new D,y=new D;for(let v=0;v<=n;++v){let E=v/n*a*Math.PI*2;x(E,a,s,e,p),x(E+.01,a,s,e,m),f.subVectors(m,p),y.addVectors(m,p),g.crossVectors(f,y),y.crossVectors(g,f),g.normalize(),y.normalize();for(let S=0;S<=r;++S){let T=S/r*Math.PI*2,C=-t*Math.cos(T),L=t*Math.sin(T);d.x=p.x+(C*y.x+L*g.x),d.y=p.y+(C*y.y+L*g.y),d.z=p.z+(C*y.z+L*g.z),l.push(d.x,d.y,d.z),u.subVectors(d,p).normalize(),c.push(u.x,u.y,u.z),h.push(v/n),h.push(S/r)}}for(let v=1;v<=n;v++)for(let E=1;E<=r;E++){let S=(r+1)*(v-1)+(E-1),T=(r+1)*v+(E-1),C=(r+1)*v+E,L=(r+1)*(v-1)+E;o.push(S,T,L),o.push(T,C,L)}function x(v,E,S,T,C){let L=Math.cos(v),I=Math.sin(v),V=S/E*v,X=Math.cos(V);C.x=T*(2+X)*.5*L,C.y=T*(2+X)*I*.5,C.z=T*Math.sin(V)*.5}this.setIndex(o),this.setAttribute("position",new He(l,3)),this.setAttribute("normal",new He(c,3)),this.setAttribute("uv",new He(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.tube,e.tubularSegments,e.radialSegments,e.p,e.q)}},wn=class i extends ut{constructor(e=new Rl(new D(-1,-1,0),new D(-1,1,0),new D(1,1,0)),t=64,n=1,r=8,a=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:r,closed:a};let s=e.computeFrenetFrames(t,a);this.tangents=s.tangents,this.normals=s.normals,this.binormals=s.binormals;let o=new D,l=new D,c=new Re,h=new D,d=[],u=[],p=[],m=[];function g(f){h=e.getPointAt(f/t,h);let y=s.normals[f],x=s.binormals[f];for(let v=0;v<=r;v++){let E=v/r*Math.PI*2,S=Math.sin(E),T=-Math.cos(E);l.x=T*y.x+S*x.x,l.y=T*y.y+S*x.y,l.z=T*y.z+S*x.z,l.normalize(),u.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,d.push(o.x,o.y,o.z)}}(function(){for(let f=0;f<t;f++)g(f);g(a===!1?t:0),(function(){for(let f=0;f<=t;f++)for(let y=0;y<=r;y++)c.x=f/t,c.y=y/r,p.push(c.x,c.y)})(),(function(){for(let f=1;f<=t;f++)for(let y=1;y<=r;y++){let x=(r+1)*(f-1)+(y-1),v=(r+1)*f+(y-1),E=(r+1)*f+y,S=(r+1)*(f-1)+y;m.push(x,v,S),m.push(v,E,S)}})()})(),this.setIndex(m),this.setAttribute("position",new He(d,3)),this.setAttribute("normal",new He(u,3)),this.setAttribute("uv",new He(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new i(new Pl[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}},j0=class extends ut{constructor(e=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:e},e!==null){let t=[],n=new Set,r=new D,a=new D;if(e.index!==null){let s=e.attributes.position,o=e.index,l=e.groups;l.length===0&&(l=[{start:0,count:o.count,materialIndex:0}]);for(let c=0,h=l.length;c<h;++c){let d=l[c],u=d.start;for(let p=u,m=u+d.count;p<m;p+=3)for(let g=0;g<3;g++){let f=o.getX(p+g),y=o.getX(p+(g+1)%3);r.fromBufferAttribute(s,f),a.fromBufferAttribute(s,y),$d(r,a,n)===!0&&(t.push(r.x,r.y,r.z),t.push(a.x,a.y,a.z))}}}else{let s=e.attributes.position;for(let o=0,l=s.count/3;o<l;o++)for(let c=0;c<3;c++){let h=3*o+c,d=3*o+(c+1)%3;r.fromBufferAttribute(s,h),a.fromBufferAttribute(s,d),$d(r,a,n)===!0&&(t.push(r.x,r.y,r.z),t.push(a.x,a.y,a.z))}}this.setAttribute("position",new He(t,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}};Ix=Object.freeze({__proto__:null,BoxGeometry:Xe,CapsuleGeometry:Kr,CircleGeometry:$r,ConeGeometry:Qt,CylinderGeometry:Ke,DodecahedronGeometry:$s,EdgesGeometry:O0,ExtrudeGeometry:ri,IcosahedronGeometry:ta,LatheGeometry:Ks,OctahedronGeometry:rs,PlaneGeometry:pi,PolyhedronGeometry:Qr,RingGeometry:F0,ShapeGeometry:G0,SphereGeometry:bt,TetrahedronGeometry:V0,TorusGeometry:wt,TorusKnotGeometry:W0,TubeGeometry:wn,WireframeGeometry:j0}),Ll=class extends qt{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},on=class extends Un{constructor(e){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new ke(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new Re(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}};as=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],a=t[n-1];t:{e:{let s;i:{n:if(!(e<r)){for(let o=n+2;;){if(r===void 0){if(e<a)break n;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(a=r,r=t[++n],e<r)break e}s=t.length;break i}if(e>=a)break t;{let o=t[1];e<o&&(n=2,a=o);for(let l=n-2;;){if(a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(r=a,a=t[--n-1],e>=a)break e}s=n,n=0}}for(;n<s;){let o=n+s>>>1;e<t[o]?s=o:n=o+1}if(r=t[n],a=t[n-1],a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,a,r)}return this.interpolate_(n,a,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,a=e*r;for(let s=0;s!==r;++s)t[s]=n[a+s];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},X0=class extends as{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Gu,endingEnd:Gu}}intervalChanged_(e,t,n){let r=this.parameterPositions,a=e-2,s=e+1,o=r[a],l=r[s];if(o===void 0)switch(this.getSettings_().endingStart){case Vu:a=e,o=2*t-n;break;case Wu:a=r.length-2,o=t+r[a]-r[a+1];break;default:a=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Vu:s=e,l=2*n-t;break;case Wu:s=1,l=n+r[1]-r[0];break;default:s=e-1,l=t}let c=.5*(n-t),h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=a*h,this._offsetNext=s*h}interpolate_(e,t,n,r){let a=this.resultBuffer,s=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,p=this._weightNext,m=(n-t)/(r-t),g=m*m,f=g*m,y=-u*f+2*u*g-u*m,x=(1+u)*f+(-1.5-2*u)*g+(-.5+u)*m+1,v=(-1-p)*f+(1.5+p)*g+.5*m,E=p*f-p*g;for(let S=0;S!==o;++S)a[S]=y*s[h+S]+x*s[c+S]+v*s[l+S]+E*s[d+S];return a}},q0=class extends as{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let a=this.resultBuffer,s=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(n-t)/(r-t),d=1-h;for(let u=0;u!==o;++u)a[u]=s[c+u]*d+s[l+u]*h;return a}},Y0=class extends as{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Tn=class{constructor(e,t,n,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=rl(t,this.TimeBufferType),this.values=rl(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:rl(e.times,Array),values:rl(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(n.interpolation=r)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Y0(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new q0(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new X0(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case sl:t=this.InterpolantFactoryMethodDiscrete;break;case ol:t=this.InterpolantFactoryMethodLinear;break;case Rc:t=this.InterpolantFactoryMethodSmooth}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0){if(e===this.DefaultInterpolation)throw new Error(n);this.setInterpolation(this.DefaultInterpolation)}return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return sl;case this.InterpolantFactoryMethodLinear:return ol;case this.InterpolantFactoryMethodSmooth:return Rc}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e}return this}trim(e,t){let n=this.times,r=n.length,a=0,s=r-1;for(;a!==r&&n[a]<e;)++a;for(;s!==-1&&n[s]>t;)--s;if(++s,a!==0||s!==r){a>=s&&(s=Math.max(s,1),a=s-1);let o=this.getValueSize();this.times=n.slice(a,s),this.values=this.values.slice(a*o,s*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!=0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,r=this.values,a=n.length;a===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let s=null;for(let o=0;o!==a;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(s!==null&&s>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,s),e=!1;break}s=l}if(r!==void 0&&E1(r))for(let o=0,l=r.length;o!==l;++o){let c=r[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Rc,a=e.length-1,s=1;for(let o=1;o<a;++o){let l=!1,c=e[o];if(c!==e[o+1]&&(o!==1||c!==e[0]))if(r)l=!0;else{let h=o*n,d=h-n,u=h+n;for(let p=0;p!==n;++p){let m=t[h+p];if(m!==t[d+p]||m!==t[u+p]){l=!0;break}}}if(l){if(o!==s){e[s]=e[o];let h=o*n,d=s*n;for(let u=0;u!==n;++u)t[d+u]=t[h+u]}++s}}if(a>0){e[s]=e[a];for(let o=a*n,l=s*n,c=0;c!==n;++c)t[l+c]=t[o+c];++s}return s!==e.length?(this.times=e.slice(0,s),this.values=t.slice(0,s*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=new this.constructor(this.name,e,t);return n.createInterpolant=this.createInterpolant,n}};Tn.prototype.TimeBufferType=Float32Array,Tn.prototype.ValueBufferType=Float32Array,Tn.prototype.DefaultInterpolation=ol;Fr=class extends Tn{};Fr.prototype.ValueTypeName="bool",Fr.prototype.ValueBufferType=Array,Fr.prototype.DefaultInterpolation=sl,Fr.prototype.InterpolantFactoryMethodLinear=void 0,Fr.prototype.InterpolantFactoryMethodSmooth=void 0;Z0=class extends Tn{};Z0.prototype.ValueTypeName="color";J0=class extends Tn{};J0.prototype.ValueTypeName="number";K0=class extends as{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let a=this.resultBuffer,s=this.sampleValues,o=this.valueSize,l=(n-t)/(r-t),c=e*o;for(let h=c+o;c!==h;c+=4)Xt.slerpFlat(a,0,s,c-o,s,c,l);return a}},Hs=class extends Tn{InterpolantFactoryMethodLinear(e){return new K0(this.times,this.values,this.getValueSize(),e)}};Hs.prototype.ValueTypeName="quaternion",Hs.prototype.DefaultInterpolation=ol,Hs.prototype.InterpolantFactoryMethodSmooth=void 0;Gr=class extends Tn{};Gr.prototype.ValueTypeName="string",Gr.prototype.ValueBufferType=Array,Gr.prototype.DefaultInterpolation=sl,Gr.prototype.InterpolantFactoryMethodLinear=void 0,Gr.prototype.InterpolantFactoryMethodSmooth=void 0;$0=class extends Tn{};$0.prototype.ValueTypeName="vector";Q0=class{constructor(e,t,n){let r=this,a,s=!1,o=0,l=0,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(h){l++,s===!1&&r.onStart!==void 0&&r.onStart(h,o,l),s=!0},this.itemEnd=function(h){o++,r.onProgress!==void 0&&r.onProgress(h,o,l),o===l&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(h){r.onError!==void 0&&r.onError(h)},this.resolveURL=function(h){return a?a(h):h},this.setURLModifier=function(h){return a=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){let d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=c.length;d<u;d+=2){let p=c[d],m=c[d+1];if(p.global&&(p.lastIndex=0),p.test(h))return m}return null}}},w1=new Q0,eh=class{constructor(e){this.manager=e!==void 0?e:w1,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let n=this;return new Promise((function(r,a){n.load(e,r,t,a)}))}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}};eh.DEFAULT_MATERIAL_NAME="__DEFAULT";ss=class extends vt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new ke(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}},Il=class extends ss{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(vt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new ke(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}},a0=new Ze,Qd=new D,ep=new D,io=class{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Re(512,512),this.map=null,this.mapPass=null,this.matrix=new Ze,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new es,this._frameExtents=new Re(1,1),this._viewportCount=1,this._viewports=[new pt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;Qd.setFromMatrixPosition(e.matrixWorld),t.position.copy(Qd),ep.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(ep),t.updateMatrixWorld(),a0.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(a0),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(a0)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),this.mapSize.x===512&&this.mapSize.y===512||(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},th=class extends io{constructor(){super(new bi(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(e){let t=this.camera,n=2*Ja*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height,a=e.distance||t.far;n===t.fov&&r===t.aspect&&a===t.far||(t.fov=n,t.aspect=r,t.far=a,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}},os=class extends ss{constructor(e,t,n=0,r=Math.PI/3,a=0,s=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(vt.DEFAULT_UP),this.updateMatrix(),this.target=new vt,this.distance=n,this.angle=r,this.penumbra=a,this.decay=s,this.map=null,this.shadow=new th}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}},tp=new Ze,Us=new D,s0=new D,ih=class extends io{constructor(){super(new bi(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new Re(4,2),this._viewportCount=6,this._viewports=[new pt(2,1,1,1),new pt(0,1,1,1),new pt(3,1,1,1),new pt(1,1,1,1),new pt(3,0,1,1),new pt(1,0,1,1)],this._cubeDirections=[new D(1,0,0),new D(-1,0,0),new D(0,0,1),new D(0,0,-1),new D(0,1,0),new D(0,-1,0)],this._cubeUps=[new D(0,1,0),new D(0,1,0),new D(0,1,0),new D(0,1,0),new D(0,0,1),new D(0,0,-1)]}updateMatrices(e,t=0){let n=this.camera,r=this.matrix,a=e.distance||n.far;a!==n.far&&(n.far=a,n.updateProjectionMatrix()),Us.setFromMatrixPosition(e.matrixWorld),n.position.copy(Us),s0.copy(n.position),s0.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(s0),n.updateMatrixWorld(),r.makeTranslation(-Us.x,-Us.y,-Us.z),tp.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(tp)}},ia=class extends ss{constructor(e,t,n=0,r=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=r,this.shadow=new ih}get power(){return 4*this.intensity*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}},nh=class extends io{constructor(){super(new gr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Dl=class extends ss{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(vt.DEFAULT_UP),this.updateMatrix(),this.target=new vt,this.shadow=new nh}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}},Dx=new Ze,Ux=new Ze,kx=new Ze,Ul=class{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=ip(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){let t=ip();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}};Nx=new D,Bx=new Xt,Ox=new D,zx=new D,Hx=new D,Fx=new Xt,Gx=new D,Vx=new D,mh="\\[\\]\\.:\\/",A1=new RegExp("["+mh+"]","g"),o0="[^"+mh+"]",R1="[^"+mh.replace("\\.","")+"]",C1=new RegExp("^"+/((?:WC+[\/:])*)/.source.replace("WC",o0)+/(WCOD+)?/.source.replace("WCOD",R1)+/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",o0)+/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",o0)+"$"),P1=["material","materials","bones","map"],Ft=class i{constructor(e,t,n){this.path=t,this.parsedPath=n||i.parseTrackName(t),this.node=i.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new i.Composite(e,t,n):new i(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(A1,"")}static parseTrackName(e){let t=C1.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let a=n.nodeName.substring(r+1);P1.indexOf(a)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=a)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(a){for(let s=0;s<a.length;s++){let o=a[s];if(o.name===t||o.uuid===t)return o;let l=n(o.children);if(l)return l}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,r=t.propertyName,a=t.propertyIndex;if(e||(e=i.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e)return void console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material)return void console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);if(!e.material.materials)return void console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);e=e.material.materials;break;case"bones":if(!e.skeleton)return void console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material)return void console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);if(!e.material.map)return void console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);e=e.material.map;break;default:if(e[n]===void 0)return void console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);e=e[n]}if(c!==void 0){if(e[c]===void 0)return void console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);e=e[c]}}let s=e[r];if(s===void 0){let c=t.nodeName;return void console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e)}let o=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(a!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);if(!e.geometry.morphAttributes)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);e.morphTargetDictionary[a]!==void 0&&(a=e.morphTargetDictionary[a])}l=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=a}else s.fromArray!==void 0&&s.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=s):Array.isArray(s)?(l=this.BindingType.EntireArray,this.resolvedProperty=s):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Ft.Composite=class{constructor(i,e,t){let n=t||Ft.parseTrackName(e);this._targetGroup=i,this._bindings=i.subscribe_(e,n)}getValue(i,e){this.bind();let t=this._targetGroup.nCachedObjects_,n=this._bindings[t];n!==void 0&&n.getValue(i,e)}setValue(i,e){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,r=t.length;n!==r;++n)t[n].setValue(i,e)}bind(){let i=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=i.length;e!==t;++e)i[e].bind()}unbind(){let i=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=i.length;e!==t;++e)i[e].unbind()}},Ft.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Ft.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},Ft.prototype.GetterByBindingType=[Ft.prototype._getValue_direct,Ft.prototype._getValue_array,Ft.prototype._getValue_arrayElement,Ft.prototype._getValue_toArray],Ft.prototype.SetterByBindingTypeAndVersioning=[[Ft.prototype._setValue_direct,Ft.prototype._setValue_direct_setNeedsUpdate,Ft.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Ft.prototype._setValue_array,Ft.prototype._setValue_array_setNeedsUpdate,Ft.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Ft.prototype._setValue_arrayElement,Ft.prototype._setValue_arrayElement_setNeedsUpdate,Ft.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Ft.prototype._setValue_fromArray,Ft.prototype._setValue_fromArray_setNeedsUpdate,Ft.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];Wx=new Float32Array(1),jx=new Re,Xx=new D,qx=new D,Yx=new D,Zx=new D,Jx=new Ze,Kx=new Ze,$x=new D,Qx=new ke,ey=new ke,ty=new D,iy=new D,ny=new D,ry=new D,ay=new Fs,sy=new nn,oy=new D;typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"160"}})),typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="160")});var zl,gh=ki(()=>{zl={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`}});var Yi,I1,vh,D1,yr,cs=ki(()=>{kn();Yi=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},I1=new gr(-1,1,1,-1,0,1),vh=class extends ut{constructor(){super(),this.setAttribute("position",new He([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new He([0,2,0,0,2,0],2))}},D1=new vh,yr=class{constructor(e){this._mesh=new yt(D1,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,I1)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}});var na,xh=ki(()=>{kn();cs();na=class extends Yi{constructor(e,t){super(),this.textureID=t!==void 0?t:"tDiffuse",e instanceof qt?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=xr.clone(e.uniforms),this.material=new qt({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new yr(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}});var ro,Hl,yh=ki(()=>{cs();ro=class extends Yi{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),a=e.state;a.buffers.color.setMask(!1),a.buffers.depth.setMask(!1),a.buffers.color.setLocked(!0),a.buffers.depth.setLocked(!0);let s,o;this.inverse?(s=0,o=1):(s=1,o=0),a.buffers.stencil.setTest(!0),a.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),a.buffers.stencil.setFunc(r.ALWAYS,s,4294967295),a.buffers.stencil.setClear(o),a.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),a.buffers.color.setLocked(!1),a.buffers.depth.setLocked(!1),a.buffers.color.setMask(!0),a.buffers.depth.setMask(!0),a.buffers.stencil.setLocked(!1),a.buffers.stencil.setFunc(r.EQUAL,1,4294967295),a.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),a.buffers.stencil.setLocked(!0)}},Hl=class extends Yi{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}});var Fl,Ap=ki(()=>{kn();gh();xh();yh();yh();Fl=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new Re);this._width=n.width,this._height=n.height,t=new _i(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:qi}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new na(zl),this.copyPass.material.blending=rp,this.clock=new Ul}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let r=0,a=this.passes.length;r<a;r++){let s=this.passes[r];if(s.enabled!==!1){if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),s.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),s.needsSwap){if(n){let o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}ro!==void 0&&(s instanceof ro?n=!0:s instanceof Hl&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new Re);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let a=0;a<this.passes.length;a++)this.passes[a].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}});var Gl,Rp=ki(()=>{kn();cs();Gl=class extends Yi{constructor(e,t,n=null,r=null,a=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=a,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new ke}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let a,s;this.overrideMaterial!==null&&(s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor)),this.clearAlpha!==null&&(a=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(a),this.overrideMaterial!==null&&(this.scene.overrideMaterial=s),e.autoClear=r}}});var Cp,Pp=ki(()=>{kn();Cp={name:"LuminosityHighPassShader",shaderID:"luminosityHighPass",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new ke(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`}});var hs,Lp=ki(()=>{kn();cs();gh();Pp();hs=class i extends Yi{constructor(e,t,n,r){super(),this.strength=t!==void 0?t:1,this.radius=n,this.threshold=r,this.resolution=e!==void 0?new Re(e.x,e.y):new Re(256,256),this.clearColor=new ke(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let a=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new _i(a,s,{type:qi}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let d=0;d<this.nMips;d++){let u=new _i(a,s,{type:qi});u.texture.name="UnrealBloomPass.h"+d,u.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(u);let p=new _i(a,s,{type:qi});p.texture.name="UnrealBloomPass.v"+d,p.texture.generateMipmaps=!1,this.renderTargetsVertical.push(p),a=Math.round(a/2),s=Math.round(s/2)}let o=Cp;this.highPassUniforms=xr.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new qt({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let l=[3,5,7,9,11];a=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let d=0;d<this.nMips;d++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(l[d])),this.separableBlurMaterials[d].uniforms.invSize.value=new Re(1/a,1/s),a=Math.round(a/2),s=Math.round(s/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;let h=zl;this.copyUniforms=xr.clone(h.uniforms),this.blendMaterial=new qt({uniforms:this.copyUniforms,vertexShader:h.vertexShader,fragmentShader:h.fragmentShader,blending:ln,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new ke,this.oldClearAlpha=1,this.basic=new Pt,this.fsQuad=new yr(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let a=0;a<this.nMips;a++)this.renderTargetsHorizontal[a].setSize(n,r),this.renderTargetsVertical[a].setSize(n,r),this.separableBlurMaterials[a].uniforms.invSize.value=new Re(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(e,t,n,r,a){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();let s=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),a&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=n.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this.fsQuad.render(e),o=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(n),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=s}getSeperableBlurMaterial(e){let t=[];for(let n=0;n<e;n++)t.push(.39894*Math.exp(-.5*n*n/(e*e))/e);return new qt({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new Re(.5,.5)},direction:{value:new Re(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(e){return new qt({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}};hs.BlurDirectionX=new Re(1,0);hs.BlurDirectionY=new Re(0,1)});var Ip,Dp=ki(()=>{Ip={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = OptimizedCineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`}});var Vl,Up=ki(()=>{kn();cs();Dp();Vl=class extends Yi{constructor(){super();let e=Ip;this.uniforms=xr.clone(e.uniforms),this.material=new Ll({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this.fsQuad=new yr(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Rt.getTransfer(this._outputColorSpace)===Ut&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===ah?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===sh?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===oh?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===no?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===lh&&(this.material.defines.AGX_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}});function ao(i,e=!1){let t=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),r=new Set(Object.keys(i[0].morphAttributes)),a={},s={},o=i[0].morphTargetsRelative,l=new ut,c=0;for(let h=0;h<i.length;++h){let d=i[h],u=0;if(t!==(d.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let p in d.attributes){if(!n.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+p+'" attribute exists among all geometries, or in none of them.'),null;a[p]===void 0&&(a[p]=[]),a[p].push(d.attributes[p]),u++}if(u!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(o!==d.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let p in d.morphAttributes){if(!r.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;s[p]===void 0&&(s[p]=[]),s[p].push(d.morphAttributes[p])}if(e){let p;if(t)p=d.index.count;else if(d.attributes.position!==void 0)p=d.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,p,h),c+=p}}if(t){let h=0,d=[];for(let u=0;u<i.length;++u){let p=i[u].index;for(let m=0;m<p.count;++m)d.push(p.getX(m)+h);h+=i[u].attributes.position.count}l.setIndex(d)}for(let h in a){let d=kp(a[h]);if(!d)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,d)}for(let h in s){let d=s[h][0].length;if(d===0)break;l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let u=0;u<d;++u){let p=[];for(let g=0;g<s[h].length;++g)p.push(s[h][g][u]);let m=kp(p);if(!m)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(m)}}return l}function kp(i){let e,t,n,r=-1,a=0;for(let c=0;c<i.length;++c){let h=i[c];if(h.isInterleavedBufferAttribute)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. InterleavedBufferAttributes are not supported."),null;if(e===void 0&&(e=h.array.constructor),e!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=h.itemSize),t!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(r===-1&&(r=h.gpuType),r!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;a+=h.array.length}let s=new e(a),o=0;for(let c=0;c<i.length;++c)s.set(i[c].array,o),o+=i[c].array.length;let l=new jt(s,t,n);return r!==void 0&&(l.gpuType=r),l}var Np=ki(()=>{kn()});function An(i){return i==="f"?{name:"Nueva rockera",ui:"#ff4a9a",body:"f",skin:15976868,face:{faceShape:"ovalF",eyeShape:"grandes",eyeStyle:"brillo",eyes:2771578,eyes2:16730778,browStyle:"arqueadas",brow:2759184,mkStyle:"natural",mkColor:12614288,lipColor:13120863},hair:{style:"longF",color:1709072,color2:3811872,accent:16730778,ribbon:1447446},beard:null,top:{type:"crop",color:1447446,accent:16051455,buttons:16743112},bottom:{type:"skirt",color:7999520,color2:16730778},belt:1447446,legwear:{type:"red",color:1118481,color2:16730778},shoes:{type:"platform",color:1447446},gloves:{type:"none",color:1447446},guitar:{type:"heart",body:16730778,guard:15921906,knob:16183775},necklace:{type:"choker",color:1447446},earrings:{type:"aros",color:14263866},bracelets:{type:"none",color:16743112},tattoos:[],acc:{}}:{name:"Nuevo rockero",ui:"#4ad8ff",body:"m",skin:15382158,face:{faceShape:"cuadrada",eyeShape:"normales",eyeStyle:"clasico",eyes:3811864,eyes2:15249440,browStyle:"gruesas",brow:2759184,mkStyle:"ninguno",mkColor:1118481},hair:{style:"long",color:1709072,color2:3811872},beard:{type:"stubble",color:1709072},top:{type:"tee",color:1447446},bottom:{type:"jeans",color:4874118},belt:2236962,legwear:null,shoes:{type:"boot",color:1710618},gloves:{type:"none",color:1447446},guitar:{type:"vee",body:1447446,guard:15921906,knob:14263866},necklace:{type:"none",color:13225174},earrings:{type:"none",color:13225174},bracelets:{type:"tachas",color:1447446},tattoos:[],acc:{}}}function Op(i,e=Math.random){let t=h=>h[Math.floor(e()*h.length)];i=i||(e()<.5?"f":"m");let n=i==="f",r=Nn[i],a=An(i),s=h=>{let d=r[h],u=d.filter(p=>!p[2]);return(e()<.08||!u.length?t(d):t(u))[0]},o=()=>t(Et.cloth),l=Math.floor(e()*Et.hair.length/2)*2,c=[Et.hair[l],Et.hair[l+1]??Et.hair[l]];return Object.assign(a,{name:t(r.names),ui:t(Et.ui),skin:t(Et.skin)}),Object.assign(a.face,{faceShape:s("faceShape"),eyeShape:s("eyeShape"),eyeStyle:s("eyeStyle"),eyes:t(Et.eyes),eyes2:t(Et.eyes),browStyle:s("browStyle"),brow:Bp(c[0],.8),mkStyle:n||e()<.45?s("mkStyle"):"ninguno",mkColor:t(Et.mk)}),n&&(a.face.lipColor=t(Et.lips)),a.hair={style:s("hair"),color:c[0],color2:c[1],accent:o(),ribbon:o()},n||(a.beard={type:e()<.35?"none":s("beard"),color:Bp(c[0],.85)}),a.top={type:s("top"),color:o(),accent:e()<.5?16051455:o(),buttons:o()},a.bottom={type:s("bottom"),color:o(),color2:o()},n&&(a.legwear={type:s("legwear"),color:o(),color2:o()}),a.shoes={type:s("shoes"),color:t([1447446,9121744,14165547,15658734,2759698,16730778])},a.gloves={type:e()<.4?"none":s("gloves"),color:t([1447446,2366e3,2763310])},a.guitar={type:s("guitar"),body:o(),guard:t(Et.guard),knob:t([16183775,1118481,14263866])},a.necklace={type:e()<.35?"none":s("necklace"),color:t(Et.metal)},a.earrings={type:e()<.4?"none":s("earrings"),color:t(Et.metal)},a.bracelets={type:e()<.4?"none":s("bracelets"),color:t(Et.metal)},a.tattoos=e()<.6?[{design:s("tatDesign"),spot:s("tatSpot"),color:t(Et.ink)}]:[],a.acc=n?{}:{studs:e()<.5,chain:e()<.4,bulletBelt:e()<.25},(a.hair.style==="mohawk"||a.hair.style==="bald")&&(a.face.brow=1710618),Sh(a),a}function _h(i){let e={...i,face:{...i.face||{}},acc:{...i.acc||{}}},t=e.acc,n=e.body==="f";return e.gloves===void 0&&(e.gloves=t.gloves!==void 0?{type:n?"mitones":"sinDedos",color:t.gloves}:null),e.necklace===void 0&&(e.necklace=t.necklace?{type:n?"corazon":"colmillo",color:13225174,pendant:14263866}:null),e.earrings===void 0&&(e.earrings=t.earring?{type:n?"aros":"argolla",color:13225174}:null),e.bracelets===void 0&&(e.bracelets=t.wrist!==void 0?{type:n?"puas":t.studs?"tachas":"cuero",color:t.wrist}:null),e.bottom?.rips&&e.bottom.type==="jeans"&&(e.bottom={...e.bottom,type:"jeansRips"}),e.tattoos=e.tattoos||[],e}function Sh(i,e){let t=Nn[i.body==="f"?"f":"m"];for(let[n,r]of Wl){if(e&&e!==n)continue;let a=t[r].find(o=>o[0]===ra(i,n)),s=a?.[2]&&ra(i,n.split(".").slice(0,-1).join("."));s&&Object.assign(s,a[2])}if(!e)for(let n of i.tattoos||[]){let r=t.tatDesign.find(a=>a[0]===n.design);r?.[2]&&(n.color=r[2].color)}}function _r(i){let e=i.body==="f"?"f":"m",t=An(e),n=_h(JSON.parse(JSON.stringify(i))),r=Nn[e];for(let a of["face","hair","top","bottom","shoes","gloves","guitar","necklace","earrings","bracelets"])n[a]={...t[a],...n[a]||{}};n.legwear=t.legwear?{...t.legwear,...n.legwear||{}}:null,n.beard=t.beard?{...t.beard,...n.beard||{}}:null;for(let a of["name","ui","skin","belt"])n[a]==null&&(n[a]=t[a]);n.legwear?.a&&(n.legwear.color=parseInt(n.legwear.a.slice(1),16),n.legwear.color2=parseInt((n.legwear.b||"#111111").slice(1),16),delete n.legwear.a,delete n.legwear.b,delete n.legwear.ruffle);for(let[a,s]of Wl){let o=r[s];o.length&&!o.some(l=>l[0]===ra(n,a))&&Mh(n,a,ra(t,a)??o[0][0])}for(let a of["eyeSize","eyeGap","nose","noseW","lips","mouthW","jaw","chin","cheek","browThick","browArch","browRidge","faceW","lashLen","makeup","shadow","tilt","liner"])delete n.face[a];return n.tattoos=(n.tattoos||[]).filter(a=>r.tatDesign.some(s=>s[0]===a.design)&&r.tatSpot.some(s=>s[0]===a.spot)),delete n.build,delete n.nails,n}function Xl(){if(bh)return bh;let i=new Map,e=t=>{for(let n in Zi)if(t[n]?.type&&t[n].type!=="none"&&aa(t.body,n,t[n].type)){let r=jl(t.body,n,t[n]);i.set(br(r),r)}};e(An("m")),e(An("f"));for(let t of["violeta","rex","kid"])e(_r(fi[t]));return bh=Object.freeze([...i.values()].map(t=>Object.freeze(t)))}function Eh(i,e=[]){if(!i)return null;let t=[...Xl(),...e],n=An(i.body);for(let r in Zi){let a=i[r];if(!a?.type||a.type==="none")continue;let s=t.filter(o=>o.b===i.body&&o.k===r&&o.t===a.type);if(!s.some(o=>br(o)===br(jl(i.body,r,a)))){if(s.length){Object.assign(a,s[s.length-1].c);continue}Nn[i.body][r].some(o=>o[0]==="none")?a.type="none":Object.assign(a,n[r])}}return i}var Bp,fi,Nn,Et,ra,Mh,Wl,zp,Th,Zi,aa,jl,br,bh,Vy,Hp=ki(()=>{Bp=(i,e)=>{let t=Number(i)>>>0,n=r=>Math.max(0,Math.min(255,Math.round(r*e)));return n(t>>16&255)<<16|n(t>>8&255)<<8|n(t&255)},fi={violeta:{name:"Violeta Voltaje",ui:"#c07bff",body:"f",skin:15976868,face:{eyeShape:"grandes",mkStyle:"ahumado",mkColor:9060070,eyes:6961832,lipColor:13120863,brow:4857728,shadow:9060070,eyeSize:1.16,faceW:.9,lashLen:1.55,makeup:1.3,browThick:.95},hair:{style:"pigtails",color:8208336,color2:10116336,accent:16751130,ribbon:4380234},top:{type:"jacket",color:10112988,accent:16051455,bow:1708080,buttons:16743112},bottom:{type:"skirt",color:6169750},belt:5559354,legwear:{type:"stockings",a:"#62e83c",b:"#2a9a2a",ruffle:9105514},shoes:{type:"platform",color:9121744},acc:{wrist:16743112,gloves:2366e3},nails:3806816,guitar:{type:"offset",body:9322470,guard:15130828,head:9322470,knob:16183775}},rex:{name:"Rex Rugido",ui:"#ff7a3a",body:"m",skin:14459514,face:{eyes:3811864,brow:4861460,nose:1.12,jaw:1.15,chin:1.1},hair:{style:"long",color:8015398,color2:11039804},beard:{type:"goatee",color:5912600},top:{type:"tank",color:3421244},bottom:{type:"jeans",color:4874118,rips:!0},shoes:{type:"boot",color:1710618},acc:{gloves:3025715,warmers:["#151515","#3a3a3a"],studs:!0,bulletBelt:!0,chain:!0,necklace:!0,wrist:1447446},build:{sw:.305,chest:.255,waist:.148,hip:.168,arm:1.1},guitar:{type:"vee",body:12591130,guard:1118481,head:12591130,knob:1118481}},kid:{name:"Calavera Kid",ui:"#5dff5a",body:"m",skin:15382158,face:{eyes:2779706,brow:1710618,nose:.95,jaw:.85,eyeSize:1.05},hair:{style:"mohawk",color:3993660,color2:2076202},top:{type:"leather",color:1908004},bottom:{type:"plaid"},belt:2236962,shoes:{type:"boot",color:2759698},acc:{studs:!0,wrist:1118481,earring:!0,chain:!0},build:{sw:.272,chest:.222,waist:.138,hip:.16,arm:.98},guitar:{type:"sg",body:1315860,guard:15921906,head:1315860,knob:14263866}}},Nn={m:{faceShape:[["cuadrada","Cuadrada"],["ovalM","Ovalada"],["alargada","Alargada"],["redondaM","Redonda"],["angulosa","Angulosa"]],eyeShape:[["normales","Normales"],["rasgados","Rasgados"],["intensos","Intensos"],["abiertos","Abiertos"],["cansados","Cansados"]],eyeStyle:[["clasico","Cl\xE1sico"],["felino","Felino"],["anillo","Anillo de fuego"],["hetero","Heterocrom\xEDa"],["fantasma","Fantasma"],["rayo","Ojos de rayo",{eyes:3844351,eyes2:16777215}],["eclipse","Eclipse",{eyes:16734736,eyes2:16765498}],["vortice","V\xF3rtice hipn\xF3tico",{eyes:9054975,eyes2:3866576}]],browStyle:[["gruesas","Gruesas"],["rectasM","Rectas"],["pobladas","Pobladas"],["cicatriz","Con cicatriz"]],mkStyle:[["ninguno","Sin pintura"],["delineado","Delineado"],["corpse","Corpse paint"],["guerra","Pintura de guerra"],["ojeras","Ojeras de gira"],["calaNeon","Calavera ne\xF3n",{mkColor:3866592}],["runas","Runas de fuego",{mkColor:16742938}],["grietas","Grietas de lava",{mkColor:16734736}]],hair:[["long","Melena"],["mohawk","Cresta"],["spiky","Puntas"],["short","Corto"],["bald","Rapado"],["furia","Furia dorada",{color:16760346,color2:16773280}],["trueno","Cresta de trueno",{color:1719e3,color2:9103615}],["llamarada","Llamarada",{color:16726538,color2:16764992}]],beard:[["none","Sin barba"],["stubble","Tres d\xEDas"],["goatee","Perilla"],["mustache","Bigote"],["full","Barba completa"],["barbaFuego","Barba de fuego",{color:16730640}],["escarcha","Barba de escarcha",{color:9097471}],["barbaRayo","Barba el\xE9ctrica",{color:2779903}]],top:[["tank","Musculosa"],["tee","Polera"],["leather","Chaqueta de cuero"],["longsleeve","Manga larga"],["infernal","Chaqueta infernal",{color:1707016}],["cromo","Armadura cromada",{color:9081510}],["neonTank","Musculosa de ne\xF3n",{color:789014}]],bottom:[["jeans","Jeans"],["jeansRips","Jeans rotos"],["leatherPants","Cuero"],["plaid","Escoc\xE9s"],["shorts","Bermudas"],["magma","Pantal\xF3n de magma",{color:1838858}],["tormenta","Cuero tormenta",{color:1053738}],["jeansGalaxia","Jeans gal\xE1cticos",{color:1708112}]],legwear:[],shoes:[["boot","Bototos"],["sneaker","Zapatillas"],["chelsea","Bot\xEDn chelsea"],["botasInfierno","Botas infernales",{color:1707016}],["botasCromo","Botas cromadas",{color:10133680}],["zapasNeon","Zapatillas de ne\xF3n",{color:789014}]],gloves:[["none","Sin guantes"],["sinDedos","Sin dedos"],["tachas","Con tachas"],["completos","Completos"],["tesla","Guantes tesla",{color:1053738}],["garrasMagma","Garras de magma",{color:1707016}],["cosmicos","Guantes c\xF3smicos",{color:1708112}]],guitar:[["vee","Flying V"],["sg","Doble cuerno"],["explorer","Explorer"],["hacha","Hacha infernal",{body:1707016}],["rayoG","Rel\xE1mpago",{body:1054794}],["llamaG","Llamarada",{body:1705989}]],necklace:[["none","Ninguno"],["colmillo","Colmillo"],["placas","Placas militares"],["pinchos","Collar de p\xFAas"],["colmilloFuego","Colmillo de drag\xF3n",{color:16738842}],["amuleto","Amuleto del trueno",{color:7002367}],["calaveraCr","Calavera cromada",{color:16722474}]],earrings:[["none","Ninguno"],["argolla","Argolla"],["arete","Aretes"],["cruz","Cruz colgante"],["gemaSangre","Gema de sangre",{color:16718394}],["rayoArete","Rayo colgante",{color:7002367}],["cruzFuego","Cruz de fuego",{color:1705989}]],bracelets:[["none","Ninguna"],["tachas","Tachas"],["cuero","Mu\xF1equera"],["cadena","Cadena"],["magmaBr","Brazalete de magma",{color:1707016}],["teslaBr","Bobina tesla",{color:7002367}],["galaxiaBr","Brazal gal\xE1ctico",{color:1708112}]],tatDesign:[["calavera","Calavera"],["llamas","Llamas"],["tribal","Tribal"],["serpiente","Serpiente"],["dragon","Drag\xF3n de fuego",{color:16734746}],["fenix","F\xE9nix",{color:16753178}],["calaveraFuego","Calavera en llamas",{color:16738842}]],tatSpot:[["brazoI","Brazo izq."],["brazoD","Brazo der."],["antebrazoI","Antebrazo izq."],["antebrazoD","Antebrazo der."],["pecho","Pecho"],["espalda","Espalda"],["cuello","Cuello"],["manoI","Mano izq."],["manoD","Mano der."]],names:["Dax Distorsi\xF3n","Toni Trueno","Leo L\xE1tigo","Zack Zumbido","Iv\xE1n \xCDcaro","Gus Gru\xF1ido","Mario Martillo"]},f:{faceShape:[["ovalF","Ovalada"],["corazonF","Coraz\xF3n"],["redondaF","Redonda"],["fina","Fina"],["suave","Mand\xEDbula suave"]],eyeShape:[["grandes","Grandes"],["almendra","Almendra"],["gata","De gata"],["redondos","Redondos"]],eyeStyle:[["brillo","Brillo anime"],["corazon","Pupila coraz\xF3n"],["estrella","Pupila estrella"],["degradado","Degradado"],["galaxia","Ojos galaxia",{eyes:8010472,eyes2:2808063}],["latido","Coraz\xF3n latiente",{eyes:16730778,eyes2:16722538}],["prisma","Ojos prisma",{eyes:16739032,eyes2:7006463}]],browStyle:[["arqueadas","Arqueadas"],["finas","Finas"],["rectasF","Rectas"],["corte","Con corte"]],mkStyle:[["ningunoF","Sin maquillaje"],["natural","Natural"],["ahumado","Ahumado"],["gotico","G\xF3tico"],["glam","Glam brillante"],["estrellaMk","Estrella"],["cristales","L\xE1grimas de cristal",{mkColor:10152191}],["aurora","Aurora boreal",{mkColor:3866544}],["mariposaMk","Alas de mariposa",{mkColor:12614655}]],hair:[["longF","Larga con flequillo"],["pigtails","Coletas"],["bob","Bob"],["ponytail","Cola alta"],["odango","Mo\xF1os"],["galaxiaH","Melena gal\xE1ctica",{color:6957752,color2:2803967}],["neonTw","Coletas ne\xF3n",{color:16726682,color2:3856639}],["fenixH","Cola de f\xE9nix",{color:16730650,color2:16765498}]],beard:[],top:[["jacket","Chaqueta con pu\xF1os"],["crop","Top corto"],["corset","Cors\xE9"],["diamante","Cors\xE9 de diamantes",{color:13156592}],["holoTop","Top hologr\xE1fico",{color:15261951}],["chaquetaNeon","Chaqueta de ne\xF3n",{color:1314846,accent:16726682}]],bottom:[["skirt","Falda tableada"],["skirtPlaid","Falda escocesa"],["mini","Minifalda de cuero"],["pitillo","Pitillo con franja"],["shortsF","Short tiro alto"],["faldaGalaxia","Falda galaxia",{color:6957752}],["pitilloHolo","Pitillo hologr\xE1fico",{color:14735615}],["faldaFuego","Falda de fuego",{color:2754565}]],legwear:[["none","Sin medias"],["stockings","Rayadas"],["tights","Panty"],["red","De red"],["calcetas","Calcetas"],["brillantina","Medias de brillantina",{color:2758208}],["redNeon","Red de ne\xF3n",{color:16726682}],["mediasRayo","Medias el\xE9ctricas",{color:1053738}]],shoes:[["platform","Plataformas"],["tallboots","Botas altas"],["hightops","Zapatillas altas"],["cristal","Plataformas de cristal",{color:16747224}],["botasHolo","Botas hologr\xE1ficas",{color:14209279}],["botasFuego","Botas de fuego",{color:2754565}]],gloves:[["none","Sin guantes"],["mitones","Mitones"],["red","De red"],["largos","Largos"],["guanteHolo","Guantes hologr\xE1ficos",{color:14735615}],["estelares","Mitones estelares",{color:6957752}],["guantesCristal","Guantes de cristal",{color:12577023}]],guitar:[["offset","Offset"],["heart","Coraz\xF3n"],["star","Estrella"],["mariposa","Mariposa",{body:14735615}],["luna","Luna creciente",{body:3807882}],["gema","Gema",{body:10152191}]],necklace:[["none","Ninguno"],["choker","Gargantilla"],["chokerTachas","Gargantilla con tachas"],["corazon","Coraz\xF3n"],["perlas","Perlas"],["corazonCristal","Coraz\xF3n de cristal",{color:16743112}],["lunaCollar","Collar lunar",{color:3807882}],["mariposaCollar","Mariposa de luz",{color:4905215}]],earrings:[["none","Ninguno"],["aros","Argollas grandes"],["estrellas","Estrellas"],["gotas","Gotas"],["fugaces","Estrellas fugaces",{color:16765498}],["gotasDiamante","Gotas de diamante",{color:12578815}],["corazonesNeon","Corazones de ne\xF3n",{color:16726682}]],bracelets:[["none","Ninguna"],["aros","Esclavas"],["perlas","Perlas"],["puas","P\xFAas"],["diamanteBr","Esclavas de diamante",{color:15261951}],["luzBr","Pulsera de luz",{color:16730778}],["fuegoBr","Brazalete de fuego",{color:16734736}]],tatDesign:[["estrellas","Estrellas"],["corazon","Coraz\xF3n"],["rosa","Rosa"],["murcielago","Murci\xE9lago"],["golondrina","Golondrina"],["mariposaT","Mariposa de luz",{color:4905215}],["lunaT","Luna m\xE1gica",{color:12614655}],["rosaNeon","Rosa de ne\xF3n",{color:16726682}]],tatSpot:[["brazoI","Brazo izq."],["brazoD","Brazo der."],["antebrazoI","Antebrazo izq."],["clavicula","Clav\xEDcula"],["musloI","Muslo izq."],["musloD","Muslo der."],["cuello","Cuello"],["manoI","Mano izq."],["mejilla","Bajo el ojo"]],names:["Luna Lava","Nina Nitro","Roxy Riff","Sonia S\xF3nica","Kira Kaos","Mila Metralla","Vera Voltio"]}},Et={skin:[16175798,15976868,15382158,14459514,13011550,11038280,9066038,6962726],ui:["#ff4a6a","#4ad8ff","#ffd23a","#9dff4a","#ff8a2a","#e08cff","#4aff9a","#ff7ac8"],eyes:[3811864,6965794,2771578,3840744,2779706,6961832,13119530,15249440,16730778,10133672],hair:[1709072,3811872,5911576,8015398,15255658,16180128,13123610,15231536,3993660,2076202,8208336,10116336,2783976,4889343,16730778,16747200,15263976,12303291,1118481,14165547,2803912],brow:[1118481,2759184,4861460,9071162,13148240,4857728,14165547,15263976],cloth:[1447446,3816004,15658734,14165547,7999520,2771672,4874118,8006328,10112988,2067002,6481980,16747034,16730778,2803912,16765498],mk:[1118481,9060070,12614288,14165547,2783976,2067002,16765498,16730778,15658734],lips:[13120863,14165547,9048112,3805232,1118481,16743112,11554906,6961832],metal:[13225174,14263866,1710618,16743112,11561530,16052198,9060070,14165547],ink:[1709088,14165547,2783976,2067002,16765498,12614655,16743112,16747034],guard:[16183775,15921906,1118481,14165547,16743112,2763306,14263866]};ra=(i,e)=>e.split(".").reduce((t,n)=>t?.[n],i),Mh=(i,e,t)=>{let n=e.split("."),r=n.pop(),a=i;for(let s of n)(a[s]==null||typeof a[s]!="object")&&(a[s]={}),a=a[s];a[r]=t},Wl=[["face.faceShape","faceShape"],["face.eyeShape","eyeShape"],["face.eyeStyle","eyeStyle"],["face.browStyle","browStyle"],["face.mkStyle","mkStyle"],["hair.style","hair"],["beard.type","beard"],["top.type","top"],["bottom.type","bottom"],["legwear.type","legwear"],["shoes.type","shoes"],["gloves.type","gloves"],["guitar.type","guitar"],["necklace.type","necklace"],["earrings.type","earrings"],["bracelets.type","bracelets"]];zp=500,Th={comun:100,leg:250},Zi={top:{n:"Torso",ic:"\u{1F455}",cols:["color","accent"]},bottom:{n:"Pantalones y faldas",ic:"\u{1F456}",cols:["color","color2"]},legwear:{n:"Medias",ic:"\u{1F9E6}",cols:["color","color2"]},shoes:{n:"Calzado",ic:"\u{1F462}",cols:["color"]},gloves:{n:"Guantes",ic:"\u{1F9E4}",cols:["color"]},guitar:{n:"Guitarras",ic:"\u{1F3B8}",cols:["body","guard","knob"]},necklace:{n:"Collares",ic:"\u{1F517}",cols:["color"]},earrings:{n:"Aros",ic:"\u{1F48E}",cols:["color"]},bracelets:{n:"Pulseras",ic:"\u26D3\uFE0F",cols:["color"]}},aa=(i,e,t)=>Nn[i]?.[e]?.find(n=>n[0]===t),jl=(i,e,t)=>{let n={};for(let r of Zi[e].cols)t[r]!=null&&(n[r]=t[r]);return{b:i,k:e,t:t.type,c:n,leg:!!aa(i,e,t.type)?.[2]}},br=i=>[i.b,i.k,i.t,...Zi[i.k].cols.map(e=>i.c[e]??"")].join(":"),bh=null;Vy=Object.freeze([["m","top","tank"],["m","top","tee"],["m","top","leather"],["m","top","longsleeve"],["m","top","infernal"],["m","top","cromo"],["m","top","neonTank"],["m","bottom","jeans"],["m","bottom","jeansRips"],["m","bottom","leatherPants"],["m","bottom","plaid"],["m","bottom","shorts"],["m","bottom","magma"],["m","bottom","tormenta"],["m","bottom","jeansGalaxia"],["m","shoes","boot"],["m","shoes","sneaker"],["m","shoes","chelsea"],["m","shoes","botasInfierno"],["m","shoes","botasCromo"],["m","shoes","zapasNeon"],["m","gloves","sinDedos"],["m","gloves","tachas"],["m","gloves","completos"],["m","gloves","tesla"],["m","gloves","garrasMagma"],["m","gloves","cosmicos"],["m","guitar","vee"],["m","guitar","sg"],["m","guitar","explorer"],["m","guitar","hacha"],["m","guitar","rayoG"],["m","guitar","llamaG"],["m","necklace","colmillo"],["m","necklace","placas"],["m","necklace","pinchos"],["m","necklace","colmilloFuego"],["m","necklace","amuleto"],["m","necklace","calaveraCr"],["m","earrings","argolla"],["m","earrings","arete"],["m","earrings","cruz"],["m","earrings","gemaSangre"],["m","earrings","rayoArete"],["m","earrings","cruzFuego"],["m","bracelets","tachas"],["m","bracelets","cuero"],["m","bracelets","cadena"],["m","bracelets","magmaBr"],["m","bracelets","teslaBr"],["m","bracelets","galaxiaBr"],["f","top","jacket"],["f","top","crop"],["f","top","corset"],["f","top","diamante"],["f","top","holoTop"],["f","top","chaquetaNeon"],["f","bottom","skirt"],["f","bottom","skirtPlaid"],["f","bottom","mini"],["f","bottom","pitillo"],["f","bottom","shortsF"],["f","bottom","faldaGalaxia"],["f","bottom","pitilloHolo"],["f","bottom","faldaFuego"],["f","legwear","stockings"],["f","legwear","tights"],["f","legwear","red"],["f","legwear","calcetas"],["f","legwear","brillantina"],["f","legwear","redNeon"],["f","legwear","mediasRayo"],["f","shoes","platform"],["f","shoes","tallboots"],["f","shoes","hightops"],["f","shoes","cristal"],["f","shoes","botasHolo"],["f","shoes","botasFuego"],["f","gloves","mitones"],["f","gloves","red"],["f","gloves","largos"],["f","gloves","guanteHolo"],["f","gloves","estelares"],["f","gloves","guantesCristal"],["f","guitar","offset"],["f","guitar","heart"],["f","guitar","star"],["f","guitar","mariposa"],["f","guitar","luna"],["f","guitar","gema"],["f","necklace","choker"],["f","necklace","chokerTachas"],["f","necklace","corazon"],["f","necklace","perlas"],["f","necklace","corazonCristal"],["f","necklace","lunaCollar"],["f","necklace","mariposaCollar"],["f","earrings","aros"],["f","earrings","estrellas"],["f","earrings","gotas"],["f","earrings","fugaces"],["f","earrings","gotasDiamante"],["f","earrings","corazonesNeon"],["f","bracelets","aros"],["f","bracelets","perlas"],["f","bracelets","puas"],["f","bracelets","diamanteBr"],["f","bracelets","luzBr"],["f","bracelets","fuegoBr"]].map(([i,e,t])=>Object.freeze({b:i,k:e,t,leg:!!aa(i,e,t)?.[2]})))});var em={};fm(em,{rock:()=>Qf});function xo(i){let e=i>>>0;return()=>{e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function O1(i){for(let e in Zi){let t=i[e];if(!t?.type)continue;let n=t.type==="none"?[]:yf(i.body,e,t.type),r=ai.own.filter(s=>s.b===i.body&&s.k===e&&!s.venta),a=n.length?Gn(n):t.type==="none"?null:Gn(r);a?Object.assign(t,{type:a.t},a.c):t.type!=="none"&&(t.type="none")}return i}function F1(i,e={}){let t={};for(let r of["faceShape","eyeShape","browStyle","mkStyle"])Object.assign(t,z1[r][e[r]]||{});let n={...B1[i],...t,...e};return e.mkColor!==void 0&&e.shadow===void 0&&(n.shadow=e.mkColor),n.irisStyle=H1[e.eyeStyle]??0,n}function Ee(i,e={}){let t=i+"|"+JSON.stringify(Object.fromEntries(Object.entries(e).map(([r,a])=>[r,a&&a.isTexture?a.uuid:a])));if(Rh.has(t))return Rh.get(t);let n=new on({color:i,gradientMap:fc,...e});return Rh.set(t,n),n}function hc(i,e=!1,t=!1){let n=i.toFixed(4)+(e?"w":"")+(t?"c":"");if(Ch.has(n))return Ch.get(n);let r=new Pt({color:657168,side:di});return r.userData.ol=!0,r.onBeforeCompile=a=>{a.vertexShader=(e?`attribute float olw;
`:"")+a.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
transformed += normalize(normal) * `+i.toFixed(5)+(e?" * olw":"")+";"),t&&lu(a)},r.customProgramCacheKey=()=>"outline"+n,Ch.set(n,r),r}function lu(i){i.vertexShader=`attribute float clp;
varying float vClp;
`+i.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
vClp = clp;`),i.fragmentShader=`varying float vClp;
`+i.fragmentShader.replace("void main() {",`void main() {
  if (vClp < 0.0) discard;`)}function sa(i){if(i.userData.legArgs){let[t,n,r,a]=i.userData.legArgs;return nt(t,n,r,{...a,clip:!0})}if(Ph.has(i))return Ph.get(i);let e=i.clone();return e.onBeforeCompile=lu,e.customProgramCacheKey=()=>"clip",Ph.set(i,e),e}function nt(i,e,t,n={}){let r=i+"|"+e+"|"+t+"|"+JSON.stringify(Object.fromEntries(Object.entries(n).map(([o,l])=>[o,l&&l.isTexture?l.uuid:l])));if(Lh.has(r))return Lh.get(r);let a=new on({color:16777215,gradientMap:fc,side:n.side??Vt,flatShading:!!n.flat,map:n.map??null,alphaTest:n.alphaTest??0,...n.mat||{}}),s={uLT:mc,uLA:{value:new ke(e)},uLB:{value:new ke(t)},uLS:{value:n.scale??8},uLK:{value:n.k??1}};return a.onBeforeCompile=o=>{Object.assign(o.uniforms,s),o.vertexShader=`varying vec3 vLp;
`+o.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
vLp = position;`),o.fragmentShader="#define LK "+q1[i]+`
`+Y1+o.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
{ vec3 lem = vec3(0.0); legApply(diffuseColor.rgb, lem, normalize(normal), normalize(vViewPosition)); totalEmissiveRadiance += lem * uLK; }`),n.clip&&lu(o)},a.customProgramCacheKey=()=>"leg"+i+(n.clip?"c":"")+(n.map?"m":"")+(n.flat?"f":"")+(n.alphaTest?"a":""),a.userData.legArgs=[i,e,t,n],Lh.set(r,a),a}function Sf(i,e,t){let n=i+"|"+e+"|"+!!t;if(Ih.has(n))return Ih.get(n);let r=new on({side:di,transparent:!0,depthWrite:!1,blending:ln,toneMapped:!1}),a={uLT:mc,uA:{value:new ke(i)},uB:{value:new ke(e)},uBolt:{value:t?1:0}};return r.onBeforeCompile=s=>{Object.assign(s.uniforms,a),s.vertexShader=`uniform float uLT; varying vec3 vLp;
`+jh+s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      vLp = position; vec3 nn = normalize(normal); float up = max(0.0, nn.y);
      float fl = lfbm(vec3(position.x * 16.0, position.y * 10.0 - uLT * 2.4, position.z * 16.0));
      transformed += nn * (0.02 + 0.05 * up * fl * fl) + vec3(0.0, 0.09 * up * fl * fl * fl, 0.0);`),s.fragmentShader=`uniform float uLT, uBolt; uniform vec3 uA, uB; varying vec3 vLp;
`+jh+s.fragmentShader.replace("#include <opaque_fragment>",`
      float dv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
      float fl = lfbm(vec3(vLp.x * 22.0, vLp.y * 14.0 - uLT * 3.2, vLp.z * 22.0));
      float al = smoothstep(0.0, 0.3, dv) * (1.0 - 0.85 * smoothstep(0.45, 0.9, dv)) * (0.6 + 1.6 * smoothstep(0.35, 0.72, fl));
      if (uBolt > 0.5) al *= 0.55 + 0.9 * step(0.6, fract(sin(floor(uLT * 14.0) * 12.9898) * 43758.5));
      gl_FragColor = vec4(mix(uB, uA, smoothstep(0.15, 0.7, dv)) * al * 2.2, 1.0);`)},r.customProgramCacheKey=()=>"aura",Ih.set(n,r),r}function he(i,e,t,{pos:n,rot:r,scale:a,outline:s=.01,shadow:o=!1,receive:l=!1}={}){let c=new yt(e,t);if(n&&c.position.set(...n),r&&c.rotation.set(...r),a!==void 0&&(typeof a=="number"?c.scale.setScalar(a):c.scale.set(...a)),c.castShadow=o,c.receiveShadow=l,i.add(c),s>0){let h=(Math.abs(c.scale.x)+Math.abs(c.scale.y)+Math.abs(c.scale.z))/3;c.add(new yt(e,hc(s/h)))}return c}function uo(i,e,t,n=18,r=7,a=1){let s=new wi(i),o=[],l=[];for(let m=0;m<=n;m++){let g=m/n;o.push(s.getPointAt(g)),l.push(s.getTangentAt(g).normalize())}let c=Math.abs(l[0].z)<.9?P(0,0,1):P(0,1,0),h=P().crossVectors(l[0],c).normalize(),d=[],u=[];for(let m=0;m<=n;m++){let g=m/n;m>0&&(h.addScaledVector(l[m],-h.dot(l[m])),h.lengthSq()<1e-12&&h.crossVectors(l[m],c),h.normalize());let f=P().crossVectors(l[m],h),y=Ue(e,t,g)*(g>.85?Ue(1,.25,(g-.85)/.15):1);for(let x=0;x<r;x++){let v=x/r*Math.PI*2,E=Math.cos(v)*y,S=Math.sin(v)*y*a;d.push(o[m].x+h.x*E+f.x*S,o[m].y+h.y*E+f.y*S,o[m].z+h.z*E+f.z*S)}}for(let m=0;m<n;m++)for(let g=0;g<r;g++){let f=m*r+g,y=m*r+(g+1)%r,x=f+r,v=y+r;u.push(f,y,x,y,v,x)}let p=new ut;return p.setAttribute("position",new He(d,3)),p.setIndex(u),p.computeVertexNormals(),p}function jp(i,e,t,n,{tip:r="point",segs:a=12,ctr:s=P(0,0,-.01),nrm:o=null}={}){let l=new wi(i),c=[],h=[],d=[[1,0],[.55,1],[-.55,1],[-1,0],[-.55,-1],[.55,-1]],u=d.length,p=P(),m=P();for(let v=0;v<=a;v++){let E=v/a,S=l.getPointAt(E),T=l.getTangentAt(E).normalize();o?p.copy(o):p.subVectors(S,s),p.addScaledVector(T,-p.dot(T)),p.lengthSq()<1e-10&&p.set(1,0,0).addScaledVector(T,-T.x),p.normalize(),m.crossVectors(T,p);let C=Ue(e,t,E),L=n*Ue(1,.7,E);if(r==="point"&&E>.62){let I=(E-.62)/.38;C*=Ue(1,.06,I*I*(3-2*I)),L*=Ue(1,.3,I)}if(E<.08){let I=E/.08;C*=Ue(.7,1,I)}for(let[I,V]of d)c.push(S.x+m.x*I*C+p.x*V*L,S.y+m.y*I*C+p.y*V*L,S.z+m.z*I*C+p.z*V*L)}for(let v=0;v<a;v++)for(let E=0;E<u;E++){let S=v*u+E,T=v*u+(E+1)%u,C=S+u,L=T+u;h.push(S,C,T,T,C,L)}let g=c.length/3,f=l.getPointAt(0),y=l.getPointAt(1);c.push(f.x,f.y,f.z,y.x,y.y,y.z);for(let v=0;v<u;v++){h.push(g,v,(v+1)%u);let E=a*u;h.push(g+1,E+(v+1)%u,E+v)}let x=new ut;return x.setAttribute("position",new He(c,3)),x.setIndex(h),x.computeVertexNormals(),x}function Z1(i){let e=xs.sole[i],t=Math.min(e*.45,.014),n=xs.ground[i]+e-t*.8,r=[];for(let a=0;a<48;a++){let s=a/48*Math.PI*2,o=.06+Math.cos(s)*.138;r.push(P(Math.sin(s)*(cu(o)*1.12*(i==="platform"?.99:1)+.0015),n,o))}return new wn(new wi(r,!0),96,.0032,5,!0)}function J1(i){let e=xs.ground[i]+xs.sole[i],t=new bt(1,30,20),n=t.attributes.position;for(let r=0;r<n.count;r++){let a=n.getX(r),s=n.getY(r),o=n.getZ(r),l=.06+o*.13,c=Ue(i==="boot"?.12:.105,i==="sneaker"?.05:.046,Oe(Se((l-.02)/.12,0,1)));n.setXYZ(r,a*cu(l)*1.05*Ue(1,.84,Oe(Se((l-.12)/.07,0,1))),e-.004+(s>0?s*c:s*.008),l)}return t.computeVertexNormals(),t}function K1(i){let e=xs.sole[i],t=new Ke(1,1,1,40,12),n=t.attributes.position,r=Math.min(e*.45,.014),a=xs.ground[i];for(let s=0;s<n.count;s++){let o=n.getY(s)+.5,l=n.getZ(s),c=.06+l*.138,h=a+(i==="platform"?.024:.01)*Oe(Se((c-.07)/.12,0,1)),d=a+e,u=Ue(h,d,o),p=Math.min(u-h,d-u),m=p<r?r-Math.sqrt(Math.max(0,r*r-(r-p)**2)):0,g=.06+l*(.138-m),f=i==="platform"?1+.05*(.5-o):1,y=i==="platform"?.003*Math.max(0,Math.cos(Math.atan2(n.getX(s),l)*30))*Oe(Se(Math.min(o,1-o)*6-.4,0,1)):0;n.setXYZ(s,n.getX(s)*(cu(g)*1.12*f-m+y),u,g)}return t.computeVertexNormals(),t}function ft(i,e,t,{repeat:n,srgb:r=!0}={}){let a=go(i,e);t(a.getContext("2d"),i,e);let s=new Jr(a);return r&&(s.colorSpace=$t),s.anisotropy=8,n&&(s.wrapS=s.wrapT=qa,s.repeat.set(...n)),s}function ps(i,e,t,n,r,a=2,s=.35){for(let o=0;o<n;o++)i.fillStyle=r[Math.floor(lt()*r.length)],i.globalAlpha=.1+lt()*s,i.beginPath(),i.arc(lt()*e,lt()*t,.5+lt()*a,0,7),i.fill();i.globalAlpha=1}function Xp(i,e,t){return ft(512,512,(n,r,a)=>{let s=a/e;for(let o=0;o<e;o++){n.fillStyle=i[o%i.length],n.fillRect(0,o*s,r,s);for(let c=0;c<26;c++){n.strokeStyle=`rgba(30,35,8,${.06+lt()*.14})`,n.lineWidth=1+lt()*2;let h=o*s+lt()*s;n.beginPath(),n.moveTo(0,h);for(let d=0;d<=r;d+=32)n.lineTo(d,h+Math.sin(d*.015+c)*2.5);n.stroke()}n.fillStyle="rgba(15,18,4,.85)",n.fillRect(0,o*s,r,3);let l=lt()*r;n.fillRect(l,o*s,3,s),n.fillStyle="rgba(25,25,15,.9)";for(let c of[l-9,l+12])for(let h of[.28,.72])n.beginPath(),n.arc(c,o*s+s*h,2.4,0,7),n.fill()}ps(n,r,a,900,["#20240a","#e8e6a0"],2.2,.2)},{repeat:t})}function Dh(i,e,t){return ft(256,256,(n,r,a)=>{n.fillStyle=i,n.fillRect(0,0,r,a);let s=6;for(let o=0;o<s;o++){let l=-lt()*30,c=a/s;for(;l<r;){let h=30+lt()*40;n.fillStyle=e[Math.floor(lt()*e.length)];let d=3+lt()*2;n.beginPath(),n.roundRect(l+d,o*c+d,h-d*2,c-d*2,7),n.fill(),n.fillStyle="rgba(255,255,255,.08)",n.fillRect(l+d+2,o*c+d+2,h-d*2-4,4),l+=h}}ps(n,r,a,1200,["#000","#fff"],1.5,.15)},{repeat:t})}function $1(){We.wood=Xp(["#93a043","#a9b350","#86933a","#9daa48"],8,[2,1]),We.woodDark=Xp(["#6b5a2e","#5e4f27","#77663a"],4,[1,1]),We.stone=Dh("#2a332c",["#6f7b6c","#5d6a5f","#7d8877","#55614f"],[1,1]),We.wall=Dh("#262d28",["#5f6b5c","#53604f","#6c7766"],[4,1]),We.patio=Dh("#2c2f27",["#4b4d3f","#55574a","#45473a","#5c5a4a"],[7,6]),We.brick=ft(256,128,(i,e,t)=>{i.fillStyle="#2b1712",i.fillRect(0,0,e,t);for(let n=0;n<t/16;n++)for(let r=n%2*-21;r<e;r+=42)i.fillStyle=["#7a3b2a","#6b3224","#844430","#5e2c20"][Math.floor(lt()*4)],i.fillRect(r+2,n*16+2,38,12);ps(i,e,t,500,["#000","#c97"],1.2,.2)},{repeat:[10,1]}),We.hedge=ft(256,128,(i,e,t)=>{i.fillStyle="#16301a",i.fillRect(0,0,e,t),ps(i,e,t,2200,["#2c5a2a","#1f4420","#3b7034","#0c1f0e"],5,.8)},{repeat:[10,1]}),We.grass=ft(256,256,(i,e,t)=>{i.fillStyle="#1c3319",i.fillRect(0,0,e,t);for(let n=0;n<2600;n++){i.strokeStyle=["#2b4a22","#173015","#33552a","#22401c"][n%4],i.lineWidth=1.2;let r=lt()*e,a=lt()*t;i.beginPath(),i.moveTo(r,a),i.lineTo(r+lt()*3-1.5,a-4-lt()*5),i.stroke()}},{repeat:[40,40]}),We.banner=ft(1024,300,(i,e,t)=>{i.fillStyle="#ddd3a8",i.fillRect(0,0,e,t),ps(i,e,t,5e3,["#b8ab7c","#f3ebc8","#a89a6a"],1.6,.4),i.strokeStyle="rgba(110,90,50,.12)",i.lineWidth=1;for(let r=0;r<e;r+=5)i.beginPath(),i.moveTo(r,0),i.lineTo(r,t),i.stroke();for(let r=0;r<t;r+=5)i.beginPath(),i.moveTo(0,r),i.lineTo(e,r),i.stroke();i.lineWidth=5,i.strokeStyle="#13220e";for(let r=0;r<12;r++){let a=10+r*88+lt()*20,s=46+lt()*40,o=60+lt()*100,l=150-o;i.fillStyle=r%3?"#62c43a":"#8be04c",i.fillRect(a,l,s,o),i.strokeRect(a,l,s,o),i.fillStyle="#13220e";for(let c=l+10;c<140;c+=20)for(let h=a+8;h<a+s-10;h+=16)i.fillRect(h,c,7,9)}let n=(r,a,s,o)=>{i.beginPath();for(let l=0;l<24;l++){let c=l/24*Math.PI*2,h=l%2?s*.5:s;i.lineTo(r+Math.cos(c)*h,a+Math.sin(c)*h)}i.closePath(),i.fillStyle=o,i.fill(),i.lineWidth=4,i.strokeStyle="#111",i.stroke()};n(170,120,70,"#4db3ff"),n(830,110,64,"#4db3ff"),n(520,80,50,"#ffe14a");for(let r=0;r<e;r+=26)i.fillStyle=r%52?"#ff9b2a":"#ffd23a",i.beginPath(),i.moveTo(r,t),i.quadraticCurveTo(r+6,t-40-lt()*30,r+13,t-70-lt()*30),i.quadraticCurveTo(r+20,t-30,r+26,t),i.fill(),i.strokeStyle="#3a1a05",i.lineWidth=2,i.stroke();i.save(),i.translate(e/2,200),i.rotate(-.04),i.font="150px Bangers, Impact, sans-serif",i.textAlign="center",i.textBaseline="middle",i.lineJoin="round",i.lineWidth=22,i.strokeStyle="#120a18",i.strokeText("PATIO BASH",0,0),i.fillStyle="#b04ce0",i.fillText("PATIO BASH",0,0),i.lineWidth=5,i.strokeStyle="#f2a8ff",i.strokeText("PATIO BASH",-3,-4),i.restore(),i.fillStyle="#7d34b0";for(let r=0;r<14;r++){let a=160+lt()*700;i.fillRect(a,250,5,15+lt()*30),i.beginPath(),i.arc(a+2.5,265+lt()*25,4,0,7),i.fill()}}),We.drumHead=ft(256,256,i=>{i.fillStyle="#efe6c8",i.fillRect(0,0,256,256);let e=(t,n,r,a,s)=>{i.beginPath();for(let o=0;o<=r*2;o++){let l=o/(r*2)*Math.PI*2,c=o%2?n:t;i.lineTo(128+Math.cos(l)*c,128+Math.sin(l)*c)}i.strokeStyle=a,i.lineWidth=s,i.stroke()};i.fillStyle="#ffb04a",i.beginPath(),i.arc(128,128,60,0,7),i.fill(),e(118,50,16,"#d0201a",7),e(90,30,12,"#ff7a1a",5),e(46,16,10,"#d0201a",4),i.lineWidth=10,i.strokeStyle="#222",i.beginPath(),i.arc(128,128,123,0,7),i.stroke()}),We.grill=ft(128,128,(i,e,t)=>{i.fillStyle="#1c1c1f",i.fillRect(0,0,e,t),i.strokeStyle="#2c2c30";for(let n=0;n<e;n+=4)i.beginPath(),i.moveTo(n,0),i.lineTo(n,t),i.stroke(),i.beginPath(),i.moveTo(0,n),i.lineTo(e,n),i.stroke()}),We.lantern=ft(128,128,(i,e,t)=>{let n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#c41a0c"),n.addColorStop(.5,"#ff5a24"),n.addColorStop(1,"#c41a0c"),i.fillStyle=n,i.fillRect(0,0,e,t),i.strokeStyle="#ffb04a",i.lineWidth=3;for(let r=6;r<t;r+=12)i.beginPath(),i.moveTo(0,r),i.lineTo(e,r),i.stroke();i.strokeStyle="rgba(120,10,0,.6)",i.lineWidth=2;for(let r=0;r<e;r+=32)i.beginPath(),i.moveTo(r,0),i.lineTo(r,t),i.stroke()}),We.bark=ft(128,256,(i,e,t)=>{i.fillStyle="#3e2e1c",i.fillRect(0,0,e,t);for(let n=0;n<90;n++){i.strokeStyle=["#2a1e11","#56412a","#4a3822"][n%3],i.lineWidth=2+lt()*4;let r=lt()*e;i.beginPath(),i.moveTo(r,0),i.bezierCurveTo(r+10,t*.3,r-10,t*.6,r+4,t),i.stroke()}},{repeat:[2,3]}),We.leaf=ft(128,512,(i,e,t)=>{i.lineCap="round";for(let n=20;n<t-10;n+=9){let r=(1-n/t)*.2+Math.sin(n/t*Math.PI)*.8;i.lineWidth=7,i.strokeStyle=n%18?"#3f7d2e":"#2f6223",i.beginPath(),i.moveTo(e/2,n),i.lineTo(e/2-58*r,n+34*r),i.stroke(),i.beginPath(),i.moveTo(e/2,n),i.lineTo(e/2+58*r,n+34*r),i.stroke()}i.lineWidth=6,i.strokeStyle="#5b8a32",i.beginPath(),i.moveTo(e/2,0),i.lineTo(e/2,t),i.stroke()}),We.flame=ft(64,64,i=>{let e=i.createRadialGradient(32,32,0,32,32,32);e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.25,"rgba(255,230,140,.9)"),e.addColorStop(.6,"rgba(255,120,30,.35)"),e.addColorStop(1,"rgba(255,60,0,0)"),i.fillStyle=e,i.fillRect(0,0,64,64)}),We.glow=ft(64,64,i=>{let e=i.createRadialGradient(32,32,0,32,32,32);e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.3,"rgba(255,255,255,.35)"),e.addColorStop(1,"rgba(255,255,255,0)"),i.fillStyle=e,i.fillRect(0,0,64,64)}),We.smoke=ft(128,128,i=>{for(let e=0;e<26;e++){let t=64+Ve(-26,26),n=64+Ve(-26,26),r=Ve(18,40),a=i.createRadialGradient(t,n,0,t,n,r);a.addColorStop(0,"rgba(255,255,255,.22)"),a.addColorStop(1,"rgba(255,255,255,0)"),i.fillStyle=a,i.fillRect(0,0,128,128)}}),We.moon=ft(256,256,i=>{let e=i.createRadialGradient(128,128,60,128,128,128);e.addColorStop(0,"rgba(220,235,220,.25)"),e.addColorStop(1,"rgba(220,235,220,0)"),i.fillStyle=e,i.fillRect(0,0,256,256),i.fillStyle="#cfd8c4",i.beginPath(),i.arc(128,128,78,0,7),i.fill();for(let t=0;t<14;t++)i.fillStyle="rgba(120,135,115,.45)",i.beginPath(),i.arc(85+lt()*90,85+lt()*90,4+lt()*14,0,7),i.fill()}),We.plaid=ft(64,64,i=>{i.fillStyle="#b3242a",i.fillRect(0,0,64,64),i.fillStyle="rgba(0,0,0,.45)",i.fillRect(0,20,64,10),i.fillRect(20,0,10,64),i.fillStyle="rgba(0,0,0,.3)",i.fillRect(0,48,64,4),i.fillRect(48,0,4,64),i.fillStyle="rgba(255,220,80,.7)",i.fillRect(0,40,64,2),i.fillRect(40,0,2,64)},{repeat:[2,3]}),We.denim=ft(64,64,i=>{i.fillStyle="#fff",i.fillRect(0,0,64,64),i.strokeStyle="rgba(0,0,30,.12)";for(let e=-64;e<64;e+=3)i.beginPath(),i.moveTo(e,0),i.lineTo(e+64,64),i.stroke();ps(i,64,64,120,["#fff","#99a"],1,.3)},{repeat:[3,4]}),We.skull=ft(64,128,i=>{i.fillStyle="#d8262b",i.fillRect(0,0,64,128),i.fillStyle="#f2f2f2",i.beginPath(),i.arc(32,50,16,0,7),i.fill(),i.fillRect(24,58,16,12),i.fillStyle="#d8262b",i.beginPath(),i.arc(26,50,5,0,7),i.arc(38,50,5,0,7),i.fill(),i.fillRect(27,64,3,6),i.fillRect(34,64,3,6),i.strokeStyle="#f2f2f2",i.lineWidth=5,i.beginPath(),i.moveTo(12,78),i.lineTo(52,98),i.moveTo(52,78),i.lineTo(12,98),i.stroke()}),We.can=ft(64,64,i=>{i.fillStyle="#e8e2d2",i.fillRect(0,0,64,64),i.fillStyle="#c2201a",i.fillRect(0,14,64,36),i.fillStyle="#fff",i.font="bold 15px sans-serif",i.fillText("LATA",14,37)}),We.rope=ft(64,16,i=>{i.fillStyle="#b8902e",i.fillRect(0,0,64,16),i.strokeStyle="#6b4e12",i.lineWidth=3;for(let e=-16;e<80;e+=8)i.beginPath(),i.moveTo(e,0),i.lineTo(e+10,16),i.stroke()},{repeat:[60,1]}),We.chain=ft(64,64,i=>{i.strokeStyle="#8a9590",i.lineWidth=2.5,i.beginPath(),i.moveTo(0,32),i.lineTo(32,0),i.lineTo(64,32),i.lineTo(32,64),i.closePath(),i.stroke()},{repeat:[40,4]}),We.house=ft(256,128,i=>{i.fillStyle="#1a2433",i.fillRect(0,0,256,128);for(let e=0;e<6;e++){let t=16+e*40,n=30+e%2*40;i.fillStyle=lt()<.55?"#ffcf6a":"#0d131c",i.fillRect(t,n,22,26),i.strokeStyle="#0a0d12",i.lineWidth=3,i.strokeRect(t,n,22,26),i.beginPath(),i.moveTo(t+11,n),i.lineTo(t+11,n+26),i.stroke()}}),We.sky=ft(4,256,(i,e,t)=>{let n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#02040a"),n.addColorStop(.55,"#0a1a26"),n.addColorStop(1,"#173a3a"),i.fillStyle=n,i.fillRect(0,0,e,t)}),We.hairStreak=ft(256,256,(i,e,t)=>{i.fillStyle="#d8d8d8",i.fillRect(0,0,e,t);for(let n=0;n<420;n++){let r=lt()*e;i.strokeStyle=lt()<.5?`rgba(0,0,0,${.08+lt()*.16})`:`rgba(255,255,255,${.2+lt()*.3})`,i.lineWidth=1+lt()*2.5,i.beginPath(),i.moveTo(r,0),i.bezierCurveTo(r+lt()*10-5,t*.3,r+lt()*10-5,t*.7,r+lt()*8-4,t),i.stroke()}},{repeat:[1,1]}),We.hairStreak.wrapS=We.hairStreak.wrapT=qa,We.skullTee=ft(512,256,(i,e,t)=>{i.fillStyle="#d8262b",i.fillRect(0,0,e,t);let n=256,r=92;i.fillStyle="#f2f2f2",i.beginPath(),i.arc(n,r,20,0,7),i.fill(),i.fillRect(n-10,r+8,20,14),i.fillStyle="#d8262b",i.beginPath(),i.arc(n-7,r,6,0,7),i.arc(n+7,r,6,0,7),i.fill(),i.fillRect(n-5,r+15,3,7),i.fillRect(n+2,r+15,3,7),i.strokeStyle="#f2f2f2",i.lineWidth=6,i.beginPath(),i.moveTo(n-26,r+30),i.lineTo(n+26,r+52),i.moveTo(n+26,r+30),i.lineTo(n-26,r+52),i.stroke()}),We.ampLogo=ft(128,40,i=>{i.font="34px Bangers, Impact",i.fillStyle="#e8e2c8",i.textAlign="center",i.textBaseline="middle",i.fillText("THUNDER",64,22)})}function Q1(i,e){return new qt({uniforms:{uColor:{value:new ke(i)},uI:{value:e}},vertexShader:"varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",fragmentShader:"uniform vec3 uColor; uniform float uI; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(normalize(vN),normalize(vV))),1.4); gl_FragColor=vec4(uColor*uI*pow(max(vY,0.0),1.7)*f,1.0); }",transparent:!0,depthWrite:!1,blending:ln,side:Vt})}function so(i,e,t,n=30){let r=[];for(let a=0;a<=n;a++){let s=a/n,o=i.clone().lerp(e,s);o.y-=t*4*s*(1-s),r.push(o)}return r}function Yp(i,e,t){i.position.copy(e);let n=P().subVectors(t,e),r=n.length();r>1e-6&&i.quaternion.setFromUnitVectors(ic,n.divideScalar(r))}function ev(){let i=Ee(16777215,{map:We.wood}),e=Ee(16777215,{map:We.woodDark}),t=Ee(16777215,{map:We.stone});Ge.background=We.sky;let n=new yt(new $r(110,48).rotateX(-Math.PI/2),Ee(16777215,{map:We.grass}));n.receiveShadow=!0,Ge.add(n);let r=new yt(new pi(27,24).rotateX(-Math.PI/2),Ee(16777215,{map:We.patio}));r.position.set(0,.01,6),r.receiveShadow=!0,Ge.add(r),he(Ge,new Xe(15,.3,7.4),i,{pos:[0,Ne-.15,-.7],outline:.03,receive:!0,shadow:!0}),he(Ge,new Xe(15.3,.42,.36),e,{pos:[0,Ne-.26,3.05],outline:.03}),he(Ge,new Xe(15,.3,.3),e,{pos:[0,Ne-.62,2.55],outline:.025});for(let ee of[-6.3,-2.1,2.1,6.3])for(let le of[2.45,-3.6])he(Ge,new Xe(1,Ne-.3,1),t,{pos:[ee,(Ne-.3)/2,le],outline:.03,receive:!0});he(Ge,new pi(14,Ne-.3),Ee(2759184),{pos:[0,(Ne-.3)/2,-2.9],outline:0});let a=new ia(16742954,5,9,1.3);a.position.set(0,.8,.4),Ge.add(a),$e.lights.under=a;for(let ee=0;ee<6;ee++)he(Ge,new Xe(.7,.6,.7),Ee(5914656),{pos:[Ve(-5,5),.3,Ve(-2.4,1.2)],rot:[0,Ve(0,1),0],outline:.02});he(Ge,new Xe(15,3.6,.6),Ee(16777215,{map:We.wall}),{pos:[0,Ne+1.8,-4.6],outline:.03,receive:!0});let s=new pi(8.6,2.5,24,1),o=s.attributes.position;for(let ee=0;ee<o.count;ee++)o.setZ(ee,Math.sin(o.getX(ee)*1.4)*.07+Math.sin(o.getX(ee)*3.1)*.03);s.computeVertexNormals(),he(Ge,s,Ee(16777215,{map:We.banner,side:Vt}),{pos:[0,Ne+1.62,-4.22],outline:0,receive:!0}),he(Ge,new Xe(2.4,.35,1),t,{pos:[6,Ne+.17,-3.75],outline:.025}),he(Ge,new Xe(2.4,.7,.55),t,{pos:[6,Ne+.35,-4.05],outline:.025});let l=(ee,le)=>{let ue=new ht;ue.position.set(ee,Ne,le),Ge.add(ue),he(ue,Pe("cab",()=>new Xe(1.05,1.25,.6)),Ee(1842204),{pos:[0,.625,0],outline:.02,shadow:!0}),he(ue,Pe("cabg",()=>new pi(.92,1.1)),Ee(16777215,{map:We.grill}),{pos:[0,.625,.302],outline:0}),he(ue,Pe("head",()=>new Xe(1.05,.38,.52)),Ee(2302755),{pos:[0,1.44,-.03],outline:.02}),he(ue,Pe("headp",()=>new Xe(.95,.12,.02)),Ee(13222832),{pos:[0,1.44,.235],outline:0});for(let ze=0;ze<6;ze++)he(ue,Pe("knob",()=>new Ke(.025,.025,.03,10).rotateX(Math.PI/2)),Ee(1118481),{pos:[-.35+ze*.13,1.44,.255],outline:0});he(ue,Pe("logo",()=>new pi(.4,.125)),new Pt({map:We.ampLogo,transparent:!0}),{pos:[.22,1.13,.304],outline:0});let Me=new yt(Pe("led",()=>new bt(.018,8,6)),new Pt({color:new ke(3,.3,.2)}));Me.position.set(.44,1.44,.25),ue.add(Me),$e.amps.push(ue)};l(-4.8,-3.5),l(4.4,-3.55);for(let ee of[-3.6,3.6])he(Ge,Pe("wedge",()=>new Xe(.95,.42,.6)),Ee(1710618),{pos:[ee,Ne+.2,2.55],rot:[-.45,ee>0?-.3:.3,0],outline:.02});for(let ee of[-7,7])he(Ge,new Xe(.4,5.7,.4),e,{pos:[ee,Ne+2.85,-3.9],outline:.025,shadow:!0});he(Ge,new Xe(14.6,.5,.5),e,{pos:[0,Ne+5.45,-3.9],outline:.025}),he(Ge,new Xe(6.2,.22,1.6),e,{pos:[-2.85,Ne+6.15,-3.75],rot:[0,0,.29],outline:.025}),he(Ge,new Xe(6.2,.22,1.6),e,{pos:[2.85,Ne+6.15,-3.75],rot:[0,0,-.29],outline:.025});for(let ee of[-1,1])he(Ge,new Xe(.22,2.6,.22),e,{pos:[ee*6.3,Ne+4.5,-3.9],rot:[0,0,ee*.6],outline:.02});let c=(ee,le,ue,Me,ze)=>{let Je=new ht;Je.position.copy(ee),Ge.add(Je),he(Je,Pe("canb",()=>new Ke(.22,.3,.5,16).rotateX(Math.PI/2)),Ee(2829104),{outline:.02}),he(Je,Pe("canr",()=>new wt(.29,.04,8,20)),Ee(4960511),{pos:[0,0,.25],outline:0});let Ye=new Pt({color:new ke(2.2,2,1.2)});he(Je,Pe("lens",()=>new $r(.26,20)),Ye,{pos:[0,0,.255],outline:0});let Ot=new En(new an({map:We.glow,color:16773296,blending:ln,depthWrite:!1,transparent:!0,opacity:.7,fog:!1}));Ot.position.set(0,0,.35),Ot.scale.setScalar(1.8),Je.add(Ot);let xt=new Ke(.22,ze,ue,24,1,!0);xt.translate(0,-ue/2,0),xt.rotateX(-Math.PI/2);let Dt=new yt(xt,Q1(16773296,Me));Je.add(Dt),$e.cans.push({g:Je,tgt:le,lens:Ye,glow:Ot,beam:Dt,base:Me})};[[-5,"p1"],[-1.8,"singer"],[1.8,"singer"],[5,"p2"]].forEach(([ee,le])=>c(P(ee,Ne+5.05,-3.45),le,7.5,.2,1.5));for(let ee of[-1,1])c(P(ee*6.9,Ne+.25,2.6),ee<0?"p1":"p2",6,.14,1.2);Ge.add(new Il(7311300,2767388,.85));let h=new os(16773328,1.7,0,.42,.7,0);h.position.set(0,13,13),h.target.position.set(0,Ne+.6,-.5),h.castShadow=!0,h.shadow.mapSize.set(2048,2048),h.shadow.camera.near=6,h.shadow.camera.far=40,h.shadow.bias=-4e-4,h.shadow.normalBias=.03,Ge.add(h,h.target),$e.lights.key=h;let d=new Dl(8040703,1.2);d.position.set(2,9,-14),Ge.add(d);for(let ee of[-1,1]){let le=new os(16769162,2.2,20,.33,.6,0);le.position.set(ee*5,Ne+5,-3.3),Ge.add(le,le.target),$e.lights[ee<0?"spotL":"spotR"]=le}let u=new os(14286746,1.6,25,.6,.8,0);u.position.set(0,Ne+.6,9),u.target.position.set(0,Ne+1.5,0),Ge.add(u,u.target);let p=new ia(16747066,0,10,1.2);p.position.set(0,Ne+1.5,2),Ge.add(p),$e.lights.fx=p;let m=new ht;m.position.set(8.8,0,-3.8),Ge.add(m);let g=Ee(16777215,{map:We.bark});he(m,new Ke(.75,1.3,14,14),g,{pos:[0,7,0],outline:.04,shadow:!0});for(let ee=0;ee<5;ee++){let le=ee/5*Math.PI*2;he(m,Pe("root",()=>new Qt(.45,1.6,6)),g,{pos:[Math.cos(le)*1.2,.4,Math.sin(le)*1.2],rot:[Math.sin(le)*1.2,0,-Math.cos(le)*1.2],outline:.03})}for(let[ee,le,ue]of[[-2.6,9.5,1.6],[2.2,10.5,.8],[-1.2,12,-1.5]]){let Me=Math.hypot(ee,ue)+1.5,ze=he(m,new Ke(.22,.42,Me,8),g,{pos:[ee/2,le-1,ue/2],outline:.03});ze.lookAt(m.localToWorld(P(ee,le+1,ue))),ze.rotateX(Math.PI/2)}for(let[ee,le,ue,Me]of[[0,14.5,0,3.6],[-3.2,12.5,1.8,2.8],[2.8,12.8,.8,2.9],[-1,13,-2.6,3],[1.5,15.5,-1,2.6]])he(m,new ta(Me,1),Ee(ct()<.5?1919526:2580012),{pos:[ee,le,ue],outline:.05});let f=Ee(16777215,{map:We.rope}),y=[so(P(-7,Ne+5.6,-3.6),P(7.8,Ne+7,1.8),1.1),so(P(-9.5,Ne+4.6,4.2),P(7.6,Ne+5.6,-2.6),1.3)];for(let ee of y)he(Ge,new wn(new wi(ee),60,.035,5),f,{outline:.015});let x=new Pt({map:We.lantern,color:new ke(1.25,1.1,1.1)}),v=Ee(1381653),E=(ee,le,ue)=>{let Me=new ht;Me.position.copy(ee),Ge.add(Me),Me.add(new is(new ut().setFromPoints([P(),P(0,-le,0)]),new Zr({color:1118481})));let ze=new ht;ze.position.y=-le-ue*.85,Me.add(ze),he(ze,Pe("lant",()=>new bt(1,20,14)),x,{scale:[ue,ue*.85,ue],outline:.02}),he(ze,Pe("lcap",()=>new Ke(.4,.45,.12,12)),v,{pos:[0,ue*.85,0],scale:ue,outline:.01}),he(ze,Pe("lcap"),v,{pos:[0,-ue*.85,0],scale:ue,outline:.01}),he(ze,Pe("tassel",()=>new Qt(.12,.6,6)),Ee(14163994),{pos:[0,-ue*.85-ue*.32,0],rot:[Math.PI,0,0],scale:ue,outline:0}),$e.lanterns.push({pivot:Me,ph:ct()*6})};y.forEach((ee,le)=>{for(let ue of le===0?[.12,.33,.55,.78,.92]:[.2,.45,.7])E(ee[Math.round(ue*(ee.length-1))],Ve(.15,.6),Ve(.32,.45))});for(let ee of[1,3]){let le=new ia(16726554,4,11,1.2),ue=$e.lanterns[ee].pivot.position;le.position.set(ue.x,ue.y-1,ue.z),Ge.add(le)}let S=[],T=ee=>{Ge.add(new is(new ut().setFromPoints(ee),new Zr({color:993810})));let le=new wi(ee),ue=Math.floor(le.getLength()/.48);for(let Me=1;Me<ue;Me++)S.push(le.getPointAt(Me/ue))},C=(ee,le)=>{let ue=[];for(let Me=0;Me<ee.length-1;Me++)ue=ue.concat(so(ee[Me],ee[Me+1],le,14).slice(Me?1:0));return ue};T(C([-7,-3.5,0,3.5,7].map(ee=>P(ee,Ne+5.18,-3.62)),.45)),T(C([-7.5,-3.75,0,3.75,7.5].map(ee=>P(ee,Ne-.1,3.27)),.35)),T(C([-6.8,-2.3,2.3,6.8].map(ee=>P(ee,Ne+3.25,-4.28)),.5)),T(so(P(-7,Ne+4.4,-3.6),P(-7.6,Ne,3.2),.6,20)),T(so(P(7,Ne+4.4,-3.6),P(7.6,Ne,3.2),.6,20));let L=new Ke(.035,.065,.15,8);L.translate(0,-.07,0);let I=new Yr(L,new Pt({color:16777215,toneMapped:!1}),S.length),V=[[2.6,.3,.3],[.3,2.4,.5],[.4,1,2.8],[2.6,2.1,.3],[.6,2.3,2.4],[2.4,.5,2.2]],X=new vt,N=new ke;S.forEach((ee,le)=>{X.position.copy(ee),X.rotation.set(Ve(-.3,.3),0,Ve(-.3,.3)),X.updateMatrix(),I.setMatrixAt(le,X.matrix);let ue=V[le%V.length];I.setColorAt(le,N.setRGB(ue[0],ue[1],ue[2]))}),Ge.add(I),$e.bulbs={mesh:I,BC:V,n:S.length};let oe=new Ke(.3,.1,.16,24,1,!0).rotateX(Math.PI/2),F=Ee(3815998,{side:Vt}),ne=Ee(2105378),$=(ee,le,ue,Me,ze,Je)=>{let Ye=new ht;Ye.position.set(ee,le,ue),Ge.add(Ye),he(Ye,new Xe(Me,ze,.9),Ee(1447448),{pos:[0,ze/2,0],outline:.025,shadow:!0});let Ot=Je>2?2:1,xt=Je>2?2:Je;for(let Dt=0;Dt<Je;Dt++){let ve=Ot>1?(Dt%2-.5)*Me*.48:0,Cn=ze/2+(xt>1?(Math.floor(Dt/Ot)-.5)*ze*.48:0),Fi=new ht;Fi.position.set(ve,Cn,.38),Ye.add(Fi);let Nt=Math.min(Me,ze)/(xt>1?1.75:1)/.65;he(Fi,oe,F,{scale:Nt*.95,outline:0}),he(Fi,Pe("torusS",()=>new wt(.3,.035,8,24)),Ee(921104),{pos:[0,0,.08*Nt],scale:Nt*.95,outline:0}),he(Fi,Pe("dcap",()=>new bt(.1,12,8,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2)),ne,{pos:[0,0,-.06*Nt],scale:Nt,outline:0}),$e.cones.push(Fi)}};for(let ee of[-1,1])$(ee*6.7,0,4.2,1.7,1.6,4),$(ee*6.7,1.6,4.2,1.7,1,2);$(-1,0,3.4,1,.9,1),$(1.1,0,3.4,1.1,1,1);let O=Ee(16777215,{map:We.can}),q=(ee,le,ue,Me)=>he(Ge,Pe("lata",()=>new Ke(.075,.075,.2,12)),O,{pos:[ee,le+(Me?.075:.1),ue],rot:Me?[Math.PI/2,Ve(0,6),0]:[0,Ve(0,6),0],outline:.008});for(let ee=0;ee<7;ee++){let le=Ve(-6.5,6.5);Math.abs(Math.abs(le)-3.4)<1||q(le,Ne,Ve(-2.5,2.8),ct()<.4)}q(6.4,3.2,4,!1),q(6.9,3.2,4.3,!1),q(-6.6,3.2,4.1,!1),q(1.2,1,3.4,!1);let se=Ne+.3;he(Ge,new Xe(3.4,.3,2.3),e,{pos:[0,Ne+.15,-2.75],outline:.025,receive:!0});let Z=new ht;Z.position.set(0,se,-2.85),Ge.add(Z);let te=Ee(14271034),Ce=Ee(14079708),R=Ee(15920344),w=Ee(14725178),K=new ht;K.position.set(0,.34,.85),Z.add(K),he(K,new Ke(.34,.34,.42,26).rotateX(Math.PI/2),te,{outline:.015,shadow:!0}),he(K,new $r(.33,26),Ee(16777215,{map:We.drumHead}),{pos:[0,0,.215],outline:0}),he(K,new wt(.34,.025,8,28),Ce,{pos:[0,0,.215],outline:0}),$e.kick=K;let W=(ee,le,ue,Me,ze,Je)=>{let Ye=new ht;return Ye.position.set(ee,le,ue),Ye.rotation.x=Je,Z.add(Ye),he(Ye,new Ke(Me,Me,ze,20),te,{outline:.012}),he(Ye,new Ke(Me*.98,Me*.98,.01,20),R,{pos:[0,ze/2+.003,0],outline:0}),Ye};W(.22,.62,.42,.17,.13,.25),W(.12,.84,.72,.13,.18,.5),W(-.18,.84,.72,.14,.2,.5),W(-.48,.42,.42,.2,.4,.1);let U=(ee,le,ue,Me,ze)=>(he(Z,new Ke(.008,.012,le,6),Ce,{pos:[ee,le/2,ue],outline:0}),he(Z,new Ke(Me*.1,Me,.025,24),w,{pos:[ee,le,ue],rot:[ze,0,ee>0?-.2:.2],outline:.008}));$e.cym=[U(.5,.95,.38,.17,.05),U(.62,1.38,.72,.3,.3),U(-.62,1.25,.62,.33,.25)],$e.cym.forEach(ee=>ee.userData.r0=ee.rotation.x),he(Z,new Ke(.2,.22,.58,14),Ee(2236962),{pos:[0,.29,-.05],outline:.012});let re=$e.micSet=new ht;Ge.add(re);let k=P(.05,Ne,1.85),H=P(0,Ne+1.72,1.5);for(let ee=0;ee<3;ee++){let le=ee/3*Math.PI*2,ue=new ht;re.add(ue),he(ue,Pe("mleg",()=>new Ke(.012,.012,.3,6).translate(0,.15,0)),Ee(2236962),{outline:0}),Yp(ue,P(k.x+Math.cos(le)*.25,Ne+.01,k.z+Math.sin(le)*.25),P(k.x,Ne+.12,k.z))}let ie=new ht;re.add(ie),he(ie,new Ke(.014,.016,k.distanceTo(H),8).translate(0,k.distanceTo(H)/2,0),Ee(5925514),{outline:.006}),Yp(ie,k,H);let ge=new ht;ge.position.copy(H),re.add(ge),ge.lookAt(P(0,Ne+1.85,1.2)),he(ge,new Ke(.022,.03,.14,10).rotateX(Math.PI/2),Ee(1710618),{pos:[0,0,.04],outline:.006}),he(ge,new bt(.038,12,10),Ee(10132130),{pos:[0,0,.13],outline:.006}),he(re,uo([k.clone().add(P(0,.4,0)),P(.3,Ne+.05,1.9),P(.9,Ne+.02,2.1),P(1.8,Ne+.02,2.4)],.01,.01,20,5),Ee(1118481),{outline:0}),$e.micGrip=new vt,$e.micGrip.position.set(0,Ne+1.6,1.52),Ge.add($e.micGrip),$e.micGrip.updateMatrixWorld();for(let ee of[-1,1])he(Ge,new Xe(.6,1.4,26),Ee(16777215,{map:We.brick}),{pos:[ee*13.5,.7,6],outline:.03}),he(Ge,new Xe(1.1,1,26),Ee(16777215,{map:We.hedge}),{pos:[ee*13.5,1.85,6],outline:.03});let pe=new yt(new pi(40,2.6),new Pt({map:We.chain,transparent:!0,alphaTest:.4,side:Vt}));pe.position.set(0,2.9,-7.6),Ge.add(pe);for(let ee=-20;ee<=20;ee+=4)he(Ge,Pe("fpost",()=>new Ke(.05,.05,4.2,6)),Ee(8029568),{pos:[ee,2.1,-7.6],outline:0});let b=new Pt({map:We.house,color:11579568}),Q=Ee(1184792),G=Ee(1778995),Y=(ee,le,ue,Me,ze)=>{let Je=new ht;Je.position.set(ee,0,le),Je.rotation.y=ze,Ge.add(Je),he(Je,new Xe(ue,Me,6),G,{pos:[0,Me/2,0],outline:.05}),he(Je,new pi(ue*.92,Me*.8),b,{pos:[0,Me*.45,3.01],outline:0}),he(Je,new Qt(ue*.75,2.6,4),Q,{pos:[0,Me+1.3,0],rot:[0,Math.PI/4,0],scale:[1,1,.75],outline:.05})};Y(-17,-16,10,5,.25),Y(-3,-22,9,6,0),Y(13,-19,11,5,-.2),Y(-22,2,8,4.5,1.3),Y(24,-2,9,5,-1.2);let ce=(ee,le,ue,Me)=>{let ze=[];for(let xt=0;xt<=8;xt++){let Dt=xt/8;ze.push(P(ee+Math.sin(Dt*1.4)*Me,Dt*ue,le))}he(Ge,new wn(new wi(ze),16,.24,7),Ee(5915944),{outline:.03});let Je=new pi(1,3.6,1,8);Je.translate(0,-1.8,0);let Ye=Je.attributes.position;for(let xt=0;xt<Ye.count;xt++){let Dt=Ye.getY(xt);Ye.setZ(xt,-(Dt*Dt)*.07)}Je.computeVertexNormals();let Ot=Ee(16777215,{map:We.leaf,transparent:!0,alphaTest:.4,side:Vt});for(let xt=0;xt<9;xt++){let Dt=new yt(Je,Ot);Dt.position.copy(ze[8]),Dt.rotation.set(0,xt/9*Math.PI*2+Ve(-.2,.2),0,"YXZ"),Dt.rotateX(-1-Ve(0,.5)),Ge.add(Dt)}};ce(-11.5,-9,9,1.2),ce(-8.5,-13,11,-.8),ce(12.5,-11,10,-1.4),ce(-15.5,1,8.5,.9),ce(16,5,9.5,-1),ce(-12.8,-5.5,4.2,.6);let xe=new En(new an({map:We.moon,fog:!1,transparent:!0,depthWrite:!1}));xe.position.set(-38,46,-110),xe.scale.setScalar(36),Ge.add(xe);let we=[];for(let ee=0;ee<1400;ee++){let le=ct()*Math.PI*2,ue=ct()*1.25;we.push(Math.sin(ue)*Math.cos(le)*200,Math.cos(ue)*200+10,Math.sin(ue)*Math.sin(le)*200)}let _e=new ut;_e.setAttribute("position",new He(we,3)),Ge.add(new Ys(_e,new qs({color:16777215,size:1.6,sizeAttenuation:!1,fog:!1,transparent:!0,opacity:.85})));let Ae=new ht;Ae.position.set(-8.4,0,5.2),Ae.rotation.y=.8,Ge.add(Ae);let be=Ee(16736168);he(Ae,new bt(.28,14,10),be,{pos:[0,.9,0],scale:[1,.75,1.4],outline:.02}),he(Ae,new wn(new wi([P(0,.95,.3),P(0,1.25,.42),P(0,1.5,.3),P(0,1.62,.38)]),12,.05,6),be,{outline:.012}),he(Ae,new bt(.1,10,8),be,{pos:[0,1.66,.42],outline:.012}),he(Ae,new Qt(.035,.16,6),Ee(1118481),{pos:[0,1.62,.55],rot:[2,0,0],outline:0});for(let ee of[-.07,.07])he(Ae,new Ke(.012,.012,.75,5),Ee(3355443),{pos:[ee,.38,0],outline:0});let Te=new ht;Te.position.copy(po),Ge.add(Te);for(let ee=0;ee<11;ee++){let le=ee/11*Math.PI*2;he(Te,Pe("rock",()=>new $s(.22,0)),Ee(5922650),{pos:[Math.cos(le)*.75,.12,Math.sin(le)*.75],rot:[ct(),ct(),ct()],outline:.012})}for(let ee=0;ee<4;ee++)he(Te,Pe("log",()=>new Ke(.08,.1,1.2,7)),Ee(4861976),{pos:[0,.18,0],rot:[Math.PI/2-.3,ee*.8,0],outline:.012});for(let ee=0;ee<22;ee++){let le=new En(new an({map:We.flame,color:ee%3?16747050:16765002,blending:ln,transparent:!0,depthWrite:!1}));Te.add(le),$e.fireSprites.push({s:le,ph:ct(),x:Ve(-.35,.35),z:Ve(-.35,.35),sp:Ve(.7,1.3)})}let Ie=new ia(16747066,6,14,1.2);Ie.position.set(po.x,1.4,po.z),Ge.add(Ie),$e.lights.fire=Ie;for(let ee of[-5.6,-2,2,5.6])he(Ge,Pe("pyro",()=>new Ke(.13,.16,.22,10)),Ee(2236966),{pos:[ee,Ne+.11,2.85],outline:.01})}function Ef(i,e,t,n,r,a){let s=n-i,o=r-e,l=Math.hypot(s,o),c=(t*t-a*a+l*l)/(2*l),h=Math.sqrt(Math.max(0,t*t-c*c)),d=i+c*s/l,u=e+c*o/l,p=[d-h*o/l,u+h*s/l],m=[d+h*o/l,u-h*s/l];return Wt(g=>{g.absarc(i,e,t,Math.atan2(m[1]-e,m[0]-i),Math.atan2(p[1]-e,p[0]-i),!0),g.absarc(n,r,a,Math.atan2(p[1]-r,p[0]-n),Math.atan2(m[1]-r,m[0]-n),!1)})}function wf(i){let e=Bt[i.type],t=new ht,n=new Ar,r=Ee(13817310),a=Ee(1184274),s=Ee(15854034),o=Ee(16184038),l=Ee(2823949),c=Ee(13144922),h=Ee(i.knob??16183775),d=new ri(e.shape(),{depth:.05,bevelEnabled:!0,bevelThickness:.013,bevelSize:.012,bevelSegments:3,curveSegments:28});d.translate(0,0,-.025);let u=e.leg,p=u?nt(u[0],i.body,u[1],{scale:u[2],side:ni}):Ee(i.body);if(he(t,d,p,{outline:.007,shadow:!0}),u){let[L,I]=tv[i.type]??[u[1],16777215],V=new yt(d,Sf(L,I,u[0]==="electric"));V.renderOrder=6,V.frustumCulled=!1,t.add(V)}e.guard&&n.add(Ee(i.guard??15921906),new ri(e.guard(),{depth:.003,bevelEnabled:!1,curveSegments:20}),[0,0,.037],[0,0,0],[1,1,1],.002),n.add(c,new Xe(.8,.054,.022),[.5,0,.016]),n.add(c,new Ke(.027,.027,.8,12,1,!1,Math.PI/2,Math.PI).rotateZ(Math.PI/2),[.5,0,.007],[0,0,0],[1,1,.65]),n.add(l,new Xe(.77,.057,.007),[.515,0,.0295],[0,0,0],[1,1,1],.003);for(let L=1;L<=22;L++){let I=Er(L);if(I<.14)break;n.add(r,new Xe(.003,.057,.004),[I,0,.034])}let m=new Ke(.0055,.0055,.002,12).rotateX(Math.PI/2);for(let L of[3,5,7,9,15,17,19]){let I=(Er(L)+Er(L-1))/2;I>.15&&n.add(o,m,[I,0,.0335])}{let L=(Er(12)+Er(11))/2;n.add(o,m,[L,.016,.0335]),n.add(o,m,[L,-.016,.0335])}n.add(s,new Xe(.006,.058,.008),[.9,0,.031]);let g=new Ke(.0028,.0028,.004,6).rotateX(Math.PI/2);for(let[L,I]of e.pickups)if(L==="hum"){n.add(i.guard===15921906?s:a,new Xe(.052,.088,.005),[I,0,.039]),n.add(a,new Xe(.04,.076,.012),[I,0,.045],[0,0,0],[1,1,1],.002);for(let V=0;V<6;V++)for(let X of[-.01,.01])n.add(r,g,[I+X,-.026+V*.0104,.052])}else{n.add(s,new Xe(.024,.078,.012),[I,0,.045],[0,0,0],[1,1,1],.002);for(let V=0;V<6;V++)n.add(a,g,[I,-.026+V*.0104,.052])}n.add(r,new Xe(.014,.08,.012),[e.bridge,0,.047],[0,0,0],[1,1,1],.002);for(let L=0;L<6;L++)n.add(r,new Xe(.008,.009,.006),[e.bridge+.004,-.026+L*.0104,.055]);e.tail!==void 0&&n.add(r,new Ke(.008,.008,.085,10),[e.tail,0,.048],[0,0,0],[1,1,1],.002),e.trem&&(n.add(r,new Xe(.055,.092,.004),[e.bridge-.01,0,.04],[0,0,0],[1,1,1],.002),n.add(r,uo([P(e.bridge-.02,-.04,.045),P(e.bridge-.03,-.07,.07),P(e.bridge-.06,-.14,.09)],.003,.003,10,5)));for(let[L,I]of e.knobs)n.add(h,new Ke(.013,.015,.018,14).rotateX(Math.PI/2),[L,I,.047],[0,0,0],[1,1,1],.002),n.add(r,new Ke(.006,.006,.004,10).rotateX(Math.PI/2),[L,I,.057]);n.add(r,new Ke(.003,.004,.028,6).rotateX(Math.PI/2+.3),[e.sw[0],e.sw[1],.05]),n.add(s,new bt(.006,8,6),[e.sw[0],e.sw[1]+.004,.064]);for(let L of[e.tailBtn,e.hornBtn])n.add(r,new Ke(.006,.006,.012,8).rotateX(Math.PI/2),[L[0],L[1],0]);let f=new ht;f.position.set(.9,0,.014),f.rotation.y=.17,t.add(f);let y=new Ar;he(f,new ri(e.head(),{depth:.017,bevelEnabled:!0,bevelThickness:.003,bevelSize:.003,bevelSegments:1}).translate(0,0,-.0085),u&&i.head===void 0?p:Ee(i.head??i.body),{outline:.006});for(let[L,I,V]of e.tuners)y.add(r,new Ke(.005,.006,.016,8).rotateX(Math.PI/2),[L,I*.7,.014]),y.add(r,new Xe(.012,.02,.006),[L,I+V*.022,-.012],[0,0,0],[1,1,1],.002),y.add(r,new Xe(.016,.014,.012),[L,I*.85,-.016]);y.build(f);let x=new vt;x.position.set(e.tip[0],e.tip[1],0),f.add(x),n.build(t,!0);let v=[];for(let L=0;L<6;L++){let I=-.026+L*.0104;v.push(e.bridge,I,.056,.9,I*.75,.036)}let E=new ut;E.setAttribute("position",new He(v,3));let S=new Tl(E,new Zr({color:u?new ke(u[1]).multiplyScalar(2.2):15658734}));t.add(S);let T=new vt;T.position.set(-.01,0,.09),t.add(T);let C=new vt;return C.position.set(Er(5),-.045,0),t.add(C),{g:t,strum:T,fret:C,tip:x,T:e,strings:S}}function lv(i,e,t,n){return i.normalize(),e.addScaledVector(i,-e.dot(i)).normalize(),ef.crossVectors(i,e),n.setFromRotationMatrix(sv.makeBasis(i,e,ef).multiply(ov[t]))}function tf(i,e,t,n,r,a,s){oa.subVectors(e,i);let o=oa.length();oa.divideScalar(o||1),o=Se(o,Math.abs(t-n)+.001,t+n-.002);let l=(t*t-n*n+o*o)/(2*o),c=Math.sqrt(Math.max(0,t*t-l*l));la.subVectors(r,i),la.addScaledVector(oa,-la.dot(oa)),la.lengthSq()<1e-8&&la.set(0,0,1),la.normalize(),a.copy(i).addScaledVector(oa,l).addScaledVector(la,c),s.copy(i).addScaledVector(oa,o)}function zh(i,e){let t=[],n=i.length;for(let r=0;r<n-1;r++){let a=i[Math.max(0,r-1)],s=i[r],o=i[r+1],l=i[Math.min(n-1,r+2)],c=Math.max(1,Math.round(Math.abs(o[0]-s[0])/e));for(let h=0;h<c;h++){let d=h/c,u=d*d,p=u*d;t.push(s.map((m,g)=>.5*(2*s[g]+(-a[g]+o[g])*d+(2*a[g]-5*s[g]+4*o[g]-l[g])*u+(-a[g]+3*s[g]-3*o[g]+l[g])*p)))}}return t.push(i[n-1].slice()),t}function af(i,e,t,n){let a=[0],s=0;for(let c=1;c<=3e3;c++)s+=n(e+(t-e)*(c-.5)/3e3),a.push(s);let o=[],l=0;for(let c=0;c<i;c++){let h=s*c/(i-1);for(;l<2999&&a[l+1]<h;)l++;let d=(h-a[l])/Math.max(1e-9,a[l+1]-a[l]);o.push(e+(t-e)*(l+Se(d,0,1))/3e3)}return o}function hn(i,e,t=.005,n=!1,r=null){let a=i.geo,s=a.attributes.position,o=a.attributes.normal,l=a.attributes.uv,c=a.attributes.skinIndex,h=a.attributes.skinWeight,d=a.attributes.color,u=a.attributes.olw,p=a.index.array,m=new Uint8Array(s.count);for(let oe=0;oe<s.count;oe++)m[oe]=e(i.meta[oe])?1:0;let g=new Int32Array(s.count).fill(-1),f=typeof t=="function"?t:()=>t,y=[],x=[],v=[],E=[],S=[],T=[],C=[],L=[],I=[],V=[],X=0;for(let oe=0;oe<p.length;oe+=3){let F=p[oe],ne=p[oe+1],$=p[oe+2];if(!(n?!(m[F]||m[ne]||m[$]):!(m[F]&&m[ne]&&m[$])))for(let O of[F,ne,$]){if(g[O]<0){g[O]=X++;let q=f(i.meta[O]);y.push(s.getX(O)+o.getX(O)*q,s.getY(O)+o.getY(O)*q,s.getZ(O)+o.getZ(O)*q),x.push(o.getX(O),o.getY(O),o.getZ(O)),v.push(l.getX(O),l.getY(O)),E.push(c.getX(O),c.getY(O),c.getZ(O),c.getW(O)),S.push(h.getX(O),h.getY(O),h.getZ(O),h.getW(O)),d&&T.push(d.getX(O),d.getY(O),d.getZ(O)),u&&C.push(u.getX(O)),r&&L.push(r(i.meta[O])),V.push(i.meta[O])}I.push(g[O])}}let N=new ut;return N.setAttribute("position",new He(y,3)),N.setAttribute("normal",new He(x,3)),N.setAttribute("uv",new He(v,2)),N.setAttribute("skinIndex",new rr(E,4)),N.setAttribute("skinWeight",new He(S,4)),d&&N.setAttribute("color",new He(T,3)),u&&N.setAttribute("olw",new He(C,1)),r&&N.setAttribute("clp",new He(L,1)),N.setIndex(I),{geo:N,meta:V}}function Pf(i,e,t=0,n=.28){let r=1-Oe(Se((i+.02)/.12,0,1)),a=Oe(Se((i-.24)/.14,0,1)),s=Oe(Se((i-.575)/.06,0,1)),o=Oe(Se((i-.66-t)/.05,0,1)),l=[[Af,r],[dv,(1-r)*(1-a)],[Rf,a*(1-s)],[pv,s*(1-o)],[Cf,s*o]],c=Oe(Se((-.07-i)/.09,0,1))*Oe(Se(Math.abs(e)/.07,0,1))*.55;c>0&&(l=l.map(([d,u])=>[d,u*(1-c)]),l.push([e>0?fa[0]:fa[1],c]));let h=.42*Oe(Se((Math.abs(e)-n*.5)/(n*.4),0,1))*Oe(Se((i-.34)/.12,0,1))*(1-s);return h>0&&(l=l.map(([d,u])=>[d,u*(1-h)]),l.push([e>0?qh[0]:qh[1],h])),l}function Lf(i,e){let t=0;for(let n of[-1,1]){let r=i-n*Di.x,a=e-Di.y,s=(r/(r*n>0?Di.ro:Di.ri))**2+(a/(a>0?Di.ru:Di.rl))**2;s<1&&(t=Math.max(t,Ue(Math.pow(1-s,.5),Math.pow(1-s,1.2)*(1+1.2*s),Oe(Se((a+.03)/.04,0,1)))))}return t}function If(i,e,t,n){Object.assign(i.uniforms,e),i.vertexShader=`varying vec3 vRest;
`+i.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
vRest = position;`),i.fragmentShader=xv+i.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
  diffuseColor.rgb *= mix(vec3(1.0), vec3(${n.join(", ")}), bustSh(${t.toFixed(1)}));`)}function yv(i,e,t){let n=i.uuid+e+"|"+t;if(Hh.has(n))return Hh.get(n);let r=i.clone(),a=i.onBeforeCompile,s={uSp:{value:e},uBust:{value:t}};r.onBeforeCompile=(l,c)=>{a.call(r,l,c),If(l,s,0,[.6,.56,.62])};let o=i.customProgramCacheKey();return r.customProgramCacheKey=()=>o+"|bust",Hh.set(n,r),r}function bv(i,e,t){let n=new vo,r=t+.06,{sw:a,chest:s,waist:o,hip:l}=e,c=e.bust??1,h=e.neck??0,d=i?[[-.175,.02,1,1,0],[-.16,l*.62,.8,.8,0],[-.12,l*1,.6,.72,0],[-.06,l*1.14,.58,.74,0],[.02,l*1.04,.6,.66,0],[.1,o*1.05,.72,.7,0],[.17,o,.74,.7,0],[.25,o*1.08,.74,.68,0],[.33,s*.9,.7,.64,0],[.4,s*.95,.64,.6,0],[.46,s,.58,.56,0],[.51,a*.98,.5,.52,0],[.545,a,.47,.5,-.002],[.575,a*.95,.45,.48,-.003],[.598,a*.86,.44,.48,-.004],[.612,a*.74,.45,.5,-.005],[.622,a*.58,.5,.55,-.006],[.629,a*.42,.62,.68,-.007],[.636,.068,.92,.98,-.008],[.655+h/2,.056,.95,1,-.01],[.68+h,.056,.95,1.05,-.012],[.72+h,.06,.92,1.05,-.014],[.755+h,.045,1,1,-.015],[.77+h,.002,1,1,-.015]]:[[-.175,.02,1,1,0],[-.16,l*.6,.8,.8,0],[-.12,l*.96,.62,.68,0],[-.06,l*1.08,.6,.7,0],[.02,l*1.03,.6,.64,0],[.1,o,.7,.66,0],[.18,o*1.04,.72,.64,0],[.27,o*1.14,.7,.62,0],[.35,s*.97,.66,.6,.004],[.42,s,.64,.6,.006],[.47,a*.88,.6,.56,.004],[.51,a*.9,.5,.52,0],[.545,a*.76,.44,.5,-.004],[.575,a*.54,.48,.56,-.007],[.6,a*.34,.6,.66,-.008],[.615,.066,.95,1,-.008],[.655+h/2,.058,.95,1,-.01],[.7+h,.059,.95,1.05,-.012],[.74+h,.062,.92,1.05,-.014],[.765+h,.035,1,1,-.015],[.775+h,.002,1,1,-.015]],u=zh(d,i?.011:.016).map(F=>(F[1]=Math.max(F[1],5e-4),F)),p=2/2.3,m=(F,ne,$)=>{let O=0;if($>0&&i)O+=Di.h*c*Lf(F,ne);else if($>0)for(let q of[-1,1])O+=.03*Math.exp(-((F-q*.074)**2)/.0036-(ne-.435)**2/(ne>.435?.004:7e-4))-.006*Math.exp(-(F*F)/4e-4-(ne-.43)**2/.004);else for(let q of[-1,1])O-=(i?.032:.02)*Math.exp(-((F-q*.068)**2)/.0045-(ne+.065)**2/.004);return O},g=i?64:40;n.grid(u.length,g,(F,ne)=>{let[$,O,q,se,Z]=u[F],te=Math.PI+ne/g*Math.PI*2,Ce=Math.sin(te),R=Math.cos(te),w=O*Math.sign(Ce)*Math.pow(Math.abs(Ce),p),K=O*(R>0?q:se)*Math.sign(R)*Math.pow(Math.abs(R),p)+m(w,$,R)*Math.min(1,O/.08)+Z;n.vert(w,r+$,K,ne/g,($+.2)/.95,Pf($,w,h,a),{part:0,s:$,a:Cr(te),x:w,w:O})});let f=F=>{let ne=0;for(;ne<u.length-2&&u[ne+1][0]<F;)ne++;let $=u[ne],O=u[ne+1],q=Se((F-$[0])/(O[0]-$[0]||1),0,1);return $.map((se,Z)=>Ue(se,O[Z],q))},y=F=>{let[,ne,$,,O]=f(F);return ne*$+m(0,F,1)+O},x=F=>{let[,ne,,$,O]=f(F);return ne*$-m(0,F,-1)-O},v=i?.044:.054,E=[[v,.003],[v*.9,.03],[v*.7,.048],[v*.4,.06],[0,.066],[-.06,.064],[-.12,.058],[-.2,.052],[-.27,.045],[-.31,.041],[-.35,.043],[-.41,.05],[-.48,.045],[-.56,.037],[-.615,.031],[-.645,.03],[-.675,.035],[-.71,.037],[-.733,.036],[-.746,.03],[-.754,.018],[-.758,.003]],S=zh(E.slice().reverse(),.01),T=e.arm??1,C=i?.86:1,L=C,I=[];for(let F=0;F<2;F++){let ne=F===0?1:-1,$=ne*a*(e.shX??.95),O=r+.5+(e.shY??0);n.grid(S.length,22,(W,U)=>{let[re,k]=S[W],H=re<-.62?-.62+(re+.62)*L:re,ie=Math.PI+U/22*Math.PI*2,ge=Math.sin(ie),pe=Math.cos(ie),b=i?-.1*Ii(H,-.03,.06)-.04*Ii(H,-.17,.07):.11*Ii(H,-.05,.05)*(.6+.4*Math.max(0,ne*ge))+.09*Ii(H,-.2,.05)*Math.max(0,pe),Q=Math.max(5e-4,k*C*(1+b+(T-1)*(Ii(H,-.1,.09)+.7*Ii(H,-.43,.06)))),G=Oe(Se((-.6-re)/.07,0,1)),Y=Ue(1,.45,G),ce=Ue(.92,1.13,G),xe=.007*C*Ii(re,-.69,.022)*Math.max(0,pe)*Math.max(0,-ne*ge),we=$+ne*(i?.004:.01)*Ii(H,-.01,.05)+ge*Q*Y-ne*xe,_e=.006*Ii(H,-.14,.05)+pe*Q*ce+xe*.4,Ae=1-.45*Oe(Se((H+.01)/.06,0,1)),be=Oe(Se((-.29-H)/.08,0,1)),Te=Oe(Se((-.622-re)/.04,0,1)),Ie=Se((-.36-re)/.25,0,1);n.vert(we,O+H,_e,U/22,H,[[Rf,1-Ae],[qh[F],Ae*(1-be)],[mv[F],Ae*be*(1-Te)*(1-Ie)],[vv[F],Ae*be*(1-Te)*Ie],[Bh[F],Te]],{part:1+F,s:H,a:Cr(ie)})});let q=P($,O-rc-ac,0),se=[],Z=[[.028,-.097,[.043,.027,.022],.0088,.06],[.0095,-.1,[.047,.03,.023],.009,.01],[-.009,-.098,[.044,.028,.022],.0085,-.04],[-.026,-.09,[.035,.022,.02],.0077,-.09]],te={base:P(-ne*.006,-.024,.021),dir:P(-ne*.18,-.82,.55).normalize(),L:[.036,.031,.027],r:.011},Ce=i?1.07:1,R=i?.9:1,w=[],K=Z.map(([W,U,re,k,H])=>({base:P(ne*.002,U,W),dir:P(0,-1,H).normalize(),L:re.map(ie=>ie*Ce),r:k*R}));te.L=te.L.map(W=>W*Ce),te.r*=R,K.push(te),K.forEach((W,U)=>{let re=W.base.clone().multiplyScalar(L).add(q),k=W.L.map(we=>we*L),H=W.r*L,ie=k[0]+k[1]+k[2],ge=Bh[F]+1+U*3,pe=[0,k[0],k[0]+k[1]];se.push(pe.map(we=>re.clone().addScaledVector(W.dir,we)));let b=U<4?P(ne,0,0):P(ne*.6,0,.8);b.addScaledVector(W.dir,-b.dot(W.dir)).normalize(),w.push({p:re.clone().addScaledVector(W.dir,ie-k[2]*.36).addScaledVector(b,H*.6),d:W.dir.clone(),n:b,r:H,l:k[2]});let Q=Math.abs(W.dir.x)>.9?P(0,1,0):P(1,0,0),G=P().crossVectors(W.dir,Q).normalize(),Y=P().crossVectors(W.dir,G),ce=U<4?-.012*L:-.018*L,xe=16;n.grid(xe+1,10,(we,_e)=>{let Ae=we/xe,be=Ue(ce,ie,Math.pow(Ae,.9)),Te=_e/10*Math.PI*2,Ie=H*(1-(i?.3:.22)*Se(be/ie,0,1))*(1+.07*(Ii(be,k[0],.004)+Ii(be,k[0]+k[1],.004))),ee=ie-Ie;be>ee&&(Ie*=Math.sqrt(Math.max(0,1-((be-ee)/Ie)**2))),Ie=Math.max(Ie,3e-4);let le=re.clone().addScaledVector(W.dir,be).addScaledVector(G,Math.cos(Te)*Ie*.84).addScaledVector(Y,Math.sin(Te)*Ie),ue=Oe(Se((be+.004)/.01,0,1)),Me=Oe(Se((be-k[0]+.004)/.008,0,1)),ze=Oe(Se((be-k[0]-k[1]+.004)/.008,0,1));n.vert(le.x,le.y,le.z,_e/10,Ae,[[Bh[F],1-ue],[ge,ue*(1-Me)],[ge+1,Me*(1-ze)],[ge+2,ze]],{part:5+F,s:-.75,k:U,t:Se(be/ie,0,1),a:0})})}),I.push({wrist:q,fingers:se,tips:w})}let X=zh([[.11,.003],[.1,.035],[.085,.06],[.05,.08],[0,.09],[-.08,.087],[-.2,.078],[-.32,.067],[-.43,.058],[-.5,.054],[-.57,.056],[-.65,.059],[-.75,.051],[-.85,.041],[-.93,.035],[-.965,.034],[-.982,.026],[-.992,.003]].slice().reverse(),.016);for(let F=0;F<2;F++){let ne=F===0?1:-1,$=ne*l*.56,O=t-.02;n.grid(X.length,24,(q,se)=>{let[Z,te]=X[q],Ce=Math.max(5e-4,te*(i?Ue(1,.88,Oe(Se((-Z-.25)/.35,0,1))):1)),R=Math.PI+se/24*Math.PI*2,w=$+Math.sin(R)*Ce,K=-.012*Ii(Z,-.64,.07)*(Math.cos(R)<0?1:.3)+.005*Ii(Z,-.5,.03)*Math.max(0,Math.cos(R))+Math.cos(R)*Ce*.97,W=Oe(Se((.07-Z)/.14,0,1)),U=Oe(Se((-.46-Z)/.08,0,1));n.vert(w,O+Z,K,se/24,Z,[[Af,1-W],[fa[F],W*(1-U)],[gv[F],W*U]],{part:3+F,s:Z,a:Cr(R)})})}let N=n.build();return N.geo.setAttribute("olw",new He(N.meta.map(F=>F.part>=5?.38:F.part===1||F.part===2?Ue(1,.5,Oe(Se((-.6-F.s)/.06,0,1)))*(i?Ue(1,.25,Oe(Se((F.s+.07)/.09,0,1))):1):1),1)),{...N,torsoAt:f,frontZ:y,backZ:x,surfAt:(F,ne)=>{let[,$,O,q,se]=f(F),Z=Math.sin(ne),te=Math.cos(ne),Ce=$*Math.sign(Z)*Math.pow(Math.abs(Z),p);return[Ce,$*(te>0?O:q)*Math.sign(te)*Math.pow(Math.abs(te),p)+m(Ce,F,te)*Math.min(1,$/.08)+se]},hand:I}}function sf(i,e=_v){for(let t=0;t<e.length-1;t++)if(i<=e[t+1][0]){let n=(i-e[t][0])/(e[t+1][0]-e[t][0]);return Ue(e[t][1],e[t+1][1],Oe(n))}return e[e.length-1][1]}function Ql(i,e){if(e<=i[0][0])return i[0][1];let t=i.length;if(e>=i[t-1][0])return i[t-1][1];let n=0;for(;i[n+1][0]<e;)n++;let r=i[Math.max(0,n-1)][1],a=i[n][1],s=i[n+1][1],o=i[Math.min(t-1,n+2)][1],l=(e-i[n][0])/(i[n+1][0]-i[n][0]);return .5*(2*a+(-r+s)*l+(2*r-5*a+4*s-o)*l*l+(-r+3*a-3*s+o)*l*l*l)}function wv(i,e,t,n){let r=new vo,a=.13,s=(i?.93:.96)*(e.faceLong??1),o=(i?.84:.88)*(e.faceW??1),l=.027*e.mouthW,c=i?-.066:-.064,h=(i?.047:.044)*e.eyeGap,d=.014,u=.0215*e.eyeSize,p=e.nose,m=e.noseW,g=-.036-.004*p,f=Se((e.jaw-.25)/.75,-.2,1.3),y=W=>W*a*1.12*(W<0?s:1),x=(W,U,re)=>{let k=y(U),H=Math.sqrt(Math.max(1e-8,1-U*U)),ie=W/H,ge=re/H,pe=a*o*H*(1+.035*Math.max(U,0)),b=a*H;if(U<0){let xe=-U;pe=a*o*Ue(Ql(Mv,xe),Ql(Sv,xe),f)*(1+.035*(e.cheek-.7)*Ii(xe,.2,.1)),b=a*Ue(Ql(Tv,xe),Ql(Ev,xe),f)*(1+.05*(e.chin-.8)*Ii(xe,.85,.08))}let Q,G;if(ge>0){let xe=i?.86:.8;Q=Math.sign(ie)*Math.pow(Math.abs(ie),xe)*pe,G=Math.pow(ge,xe)*b}else Q=ie*Ue(pe,a*o*H,Oe(Se(-ge/.6,0,1))),G=ge*a*H*1.07*(1-.32*Oe(Se((-.2-U)/.8,0,1)));let Y=Math.abs(W),ce=Math.sign(W);return re>-.2&&(Q-=ce*.004*Math.exp(-((Y-.85)**2+(U-.35)**2)/.03)),[Q,k,G]},v=(W,U,re)=>{let k=Math.abs(W),H=0;H+=.004*e.browRidge*Rn(k,U,.035,.05,.03,.01),re&&(H-=.0032*Rn(k,U,h,d+.004,.02,.014)),H+=.003*e.cheek*Rn(k,U,.062,-.028,.02,.016);let ie=Se((.03-U)/(.03-g),0,1),ge=Oe(Se((.042-U)/.014,0,1))*Oe(Se((U-(g-.012))/.006,0,1));H+=ge*(.003+.013*ie*ie*p)*Math.exp(-(W*W)/(2*(.005+.0035*ie*m)**2)),H+=.01*p*Rn(W,U,0,g-.002,.0085*m,.0072),H+=.0068*Rn(k,U,.0108*m,g-.004,.006,.0055),H-=.004*Rn(W,U,0,g-.012,.011,.003);let pe=Oe(Se((l-k)/.006,0,1));return H+=.0026*e.lips*Rn(W,U,0,c+.0045,l*.75,.0035)*pe+.0048*e.lips*Rn(W,U,0,c-.006,l*.65,.0045)*pe,H-=.0028*Rn(W,U,0,c-.018,.015,.004),H+=.005*e.chin*Rn(W,U,0,c-.05,.016,.012),H-=.0018*Rn(k,U,.034,c+.012,.006,.014),H},E=W=>Oe(Se((W-.25)/.35,0,1)),S=Math.acos(Se(c/(a*1.12*s),-1,1)),T=af(116,.003,Math.PI-.003,W=>1+2.4*Math.exp(-((W-1.75)**2)/(2*.34*.34))).filter(W=>Math.abs(W-S)>.008),C=[[-.0065,0,1],[-.0042,0,2],[-.0018,.14,2],[-2e-4,.18,3],[.0016,.62,3],[.0034,.82,5],[.005,.94,3],[.0066,1,4]],L=T.map(W=>({t:W,b:null})).concat(C.map(([W,U,re])=>({t:S+W,b:[U,re]}))).sort((W,U)=>U.t-W.t),I=96,V=af(I+1,0,1,W=>{let U=Cr(Math.PI+W*Math.PI*2);return 1+2.2*Math.exp(-(U*U)/(2*.6*.6))}),X=W=>new ke(W),N=X(t.skin),oe=X(e.lipColor??11554906),F=X(15854562),ne=X(2754316),$=X(10107461),O=N.clone().lerp(oe,i?1:.4),q=[],se=[],Z=[];r.grid(L.length,I,(W,U)=>{let re=L[W],k=re.t,H=V[U],ie=Math.PI+H*Math.PI*2,ge=Math.sin(k)*Math.sin(ie),pe=Math.cos(k),b=Math.sin(k)*Math.cos(ie),[Q,G,Y]=x(ge,pe,b),ce=E(b);Y+=ce*v(Q,G,!0);let xe=Math.abs(Q),we=Oe(Se((l+.002-xe)/.007,0,1))*ce,_e=Oe(Se((c+.006-G)/.03,0,1)),Ae=re.b?re.b[0]:k>S?1:0,be=Oe(Se((b+.15)/.55,0,1))*(pe>-.93?1:.5),Te=Math.pow(Math.max(0,1-(xe/(l*1.02))**2),.6),Ie=be*Ue(_e,Ae,we*Te);if(q.push((Q+ar.X)/(2*ar.X),(G-ar.Y0)/(ar.Y1-ar.Y0)),Z.push(Oe(Se((b-.02)/.3,0,1))),re.b){let ee=re.b[1],le=ee===2?F:ee===3?ne:ee===5?$:O;se.push(le.r,le.g,le.b,we)}else se.push(0,0,0,0);r.vert(Q+n.x,G+n.y,Y+n.z,H*4,1-k/Math.PI,[[Cf,1-Ie],[fv,Ie]],{nx:ge,ny:pe,nz:b,X:Q,Y:G,Z:Y,ph:Math.abs(Cr(ie)),jw:Ie})});let te=r.build();te.geo.setAttribute("fuv",new He(q,2)),te.geo.setAttribute("ffw",new He(Z,1)),te.geo.setAttribute("fovr",new He(se,4)),te.geo.setAttribute("olw",new He(te.meta.map(W=>Ue(1,.12,Oe(Se((W.nz-.5)/.3,0,1)))),1));let Ce=.7+.3*e.lips,R=new Array(13).fill(0);for(let W of te.meta)if(W.nz>.05){let U=Math.round(Math.abs(W.X)/.01);U<13&&(R[U]=Math.min(R[U],W.Y))}for(let W=1;W<13;W++)R[W]===0&&(R[W]=R[W-1]);return{...te,eye:{x:h,y:d,hw:u},mw:l,vm:c,tY:g,nwd:m,lf:Ce,jaw:R,contour:W=>{let U=W>=0?W/(a*1.12):W/(a*1.12*s),re=Se(U,-.999,.999);return x(Math.sqrt(1-re*re),re,0)[0]},frontZ:(W,U)=>{let re=Se(U>=0?U/(a*1.12):U/(a*1.12*s),-.999,.999),k=Math.sqrt(1-re*re),H=x(k,re,0)[0],ie=Math.min(.999,Math.pow(Math.min(1,Math.abs(W)/H),1/.8)),ge=Math.sqrt(1-ie*ie);return x(Math.sign(W)*ie*k,re,ge*k)[2]+E(ge*k)*v(W,U,!0)}}}function Av(i,e,t,n){let a=go(1024,1024),s=a.getContext("2d"),{X:o,Y0:l,Y1:c}=ar,h=1024/(2*o),d=1024/(c-l),u=b=>(b+o)*h,p=b=>(c-b)*d,m=b=>b.isColor?b:new ke(b),g=(b,Q=1)=>{let G=m(b).clone().convertLinearToSRGB();return"rgba("+Math.round(G.r*255)+","+Math.round(G.g*255)+","+Math.round(G.b*255)+","+Q+")"},f=(b,Q,G)=>new ke(b).lerp(new ke(Q),G),y=16777215,x=b=>f(t.skin,6954520,b),v=(b,Q,G,Y,ce,xe,we=0)=>{s.save(),s.translate(u(b),p(Q)),s.rotate(we),s.scale(G*h,Y*d);let _e=s.createRadialGradient(0,0,0,0,0,1);_e.addColorStop(0,g(ce,xe)),_e.addColorStop(1,g(ce,0)),s.fillStyle=_e,s.beginPath(),s.arc(0,0,1,0,7),s.fill(),s.restore()};s.fillStyle=g(t.skin),s.fillRect(0,0,1024,1024);let E=xo(t.skin&65535);for(let b=0;b<1400;b++)s.fillStyle=E()<.5?"rgba(255,242,228,0.035)":"rgba(130,55,35,0.028)",s.beginPath(),s.ellipse(E()*1024,E()*1024,8+E()*26,3+E()*7,E()*3,0,7),s.fill();let S=n.eye,T=S.hw,C=[-1,1],L=T*(i?.66:.56)*(e.eyeOpen??1),I=T*(i?.38:.33)*(e.lowLid??1),V=e.makeup??(i?.6:e.shadow?.5:0),X=e.shadow??12614288,N=f(X,1706016,.45);for(let b of C)v(b*(S.x+.003),S.y+T*1,T*1.4,.009,x(.5),.14),V>0&&(v(b*(S.x+T*.1),S.y+L*.45,T*1.3,L*1.25,X,.5*V),v(b*(S.x+T*.25),S.y+L*.5,T*1,L*.8,X,.3*V),v(b*(S.x+T*.85),S.y+L*.55,T*.65,L*.95,N,.5*V,b*.5),v(b*(S.x+T*.95),S.y+L*.65,T*.35,L*.4,N,.3*V,b*.6),v(b*(S.x+T*.2),S.y+L*1.45,T*1.25,L*.45,X,.2*V),v(b*(S.x+T*.55),S.y-I*1.25,T*.65,I*.35,N,.32*V),v(b*(S.x-T*1),S.y+L*.05,T*.18,L*.25,y,.5*V),v(b*(S.x-T*.1),S.y+L*.85,T*.35,L*.25,y,.16*V),v(b*(S.x+T*.3),S.y+L+.011,T*.9,.0025,y,.14*V),v(b*.05,-.012,.016,.004,y,.12*V,-b*.3)),v(b*S.x,S.y-T*.6,T*.9,.0035,13664384,i?.16:.1),v(b*.052,-.026,.026,.012,16736134,i?.28+.1*V:.08,-b*.25);let oe=1182228;if(e.guyliner)for(let b of C)v(b*(S.x+T*.1),S.y+L*.2,T*1.35,L*1.1,oe,.38),v(b*(S.x+T*.2),S.y-I*.9,T*1.05,I*.75,oe,.55);if(e.bags)for(let b of C)v(b*(S.x+T*.1),S.y-I*1.7,T*1.05,I*.95,5906512,.32),v(b*(S.x+T*.1),S.y-I*1.3,T*.9,I*.5,3805232,.25);if(e.mkGoth)for(let b of C){v(b*(S.x+T*.1),S.y-I*.9,T*1.15,I*.75,oe,.65),s.strokeStyle=g(oe,.8),s.lineCap="round";for(let[Q,G]of[[.15,1],[.6,.7]])s.lineWidth=5-Q*3,s.beginPath(),s.moveTo(u(b*(S.x+T*Q)),p(S.y-I*1.1)),s.quadraticCurveTo(u(b*(S.x+T*Q+.002)),p(S.y-I*2.4),u(b*(S.x+T*Q-.001)),p(S.y-I*(2.4+2.2*G))),s.stroke()}if(e.glitter)for(let b=0;b<320;b++){let Q=E()<.5?-1:1,G=Q*(S.x+(E()-.35)*T*2.3),Y=S.y+L*(.35+E()*1.3);s.fillStyle=E()<.55?"rgba(255,255,255,0.9)":g(f(X,y,.4),.95),s.beginPath(),s.arc(u(G),p(Y),1+E()*2.4,0,7),s.fill()}if(e.star){let b=u(S.x+T*.1),Q=p(S.y+L*.25),G=T*2.3*h,Y=T*1*h;s.beginPath();for(let ce=0;ce<10;ce++){let xe=-Math.PI/2+ce*Math.PI/5,we=ce%2?Y:G;s.lineTo(b+Math.cos(xe)*we,Q+Math.sin(xe)*we*1.05)}s.closePath(),s.fillStyle=g(X,.9),s.fill(),s.lineWidth=5,s.strokeStyle=g(oe,.85),s.stroke()}if(e.warpaint){let b=S.y+L*1.25,Q=S.y-I*1.7;s.fillStyle=g(X,.93),s.beginPath();for(let G=0;G<=12;G++){let Y=Ue(-.095,.095,G/12);s.lineTo(u(Y),p(b+(G%2?.003:-.002)-.006*Math.exp(-(Y*Y)/6e-4)))}for(let G=12;G>=0;G--){let Y=Ue(-.095,.095,G/12);s.lineTo(u(Y),p(Q+(G%2?-.003:.002)+.01*Math.exp(-(Y*Y)/2e-4)))}s.closePath(),s.fill(),s.strokeStyle=g(X,.93),s.lineCap="round",s.lineWidth=.0045*h;for(let G of C)for(let Y=0;Y<3;Y++){let ce=G*(S.x-T*.4+Y*T*.55);s.beginPath(),s.moveTo(u(ce),p(Q-.004)),s.lineTo(u(ce+G*.004),p(Q-.022+Y*.003)),s.stroke()}}let F=n.tY,ne=n.nwd;s.save(),s.filter="blur(5px)",s.fillStyle=g(x(.7),.42),s.beginPath(),s.moveTo(u(-.0035),p(S.y+.004)),s.lineTo(u(-.0062*ne),p(F+.012)),s.lineTo(u(-.0098*ne),p(F-.001)),s.lineTo(u(-.0045*ne),p(F-.006)),s.lineTo(u(-.0022),p(F+.006)),s.closePath(),s.fill(),s.restore(),v(-.0085*ne,F-.0015,.0046,.0055,x(.75),.36),v(.0075*ne,F-.002,.004,.005,x(.6),.14),v(0,F+.001,.0085,.0065,16743034,i?.15:.1),v(.0022,F+.0035,.0032,.0042,y,.2),s.strokeStyle=g(x(.9),.5),s.lineWidth=3,s.lineCap="round",s.beginPath(),s.moveTo(u(-.0078*ne),p(F-.0055)),s.quadraticCurveTo(u(-.003),p(F-.0105),u(.0035),p(F-.0085)),s.stroke(),v(0,F-.0098,.0092,.0026,x(.85),.36);for(let b of C)s.fillStyle=g(x(.95),.5),s.beginPath(),s.ellipse(u(b*.0052*ne),p(F-.0074),.0019*h,8e-4*d,-b*.45,0,7),s.fill();for(let b=0;b>-.128;b-=.004){let Q=n.contour(b),G=Oe(Se(-b/.04,0,1));for(let Y of C)v(Y*(Q-.006),b,.011,.007,x(.7),(Y<0?.13:.07)*G)}for(let b of C)v(b*.06,-.05,.012,.016,x(.6),b<0?.1:.05);v(0,-.118,.016,.006,16777215,.08);let $=n.vm,O=n.mw,q=n.lf;v(0,(F+$)/2-.002,.0032,.008,x(.45),.12);let se=Nf[t.beard?.type]?"full":t.beard?.type,Z=se==="stubble"?.4:se==="full"||se==="goatee"?.2:se==="mustache"?.08:0;if(Z){let b=t.beard?.color??t.hair?.color??2759184,Q=G=>Df(n,Math.abs(G))+.004;s.save(),s.filter="blur(7px)",s.beginPath();for(let G=0;G<=48;G++){let Y=Ue(-.1,.1,G/48);s.lineTo(u(Y),p(Q(Y)))}s.lineTo(u(.1),p(-.17)),s.lineTo(u(-.1),p(-.17)),s.closePath(),s.fillStyle=g(b,Z),s.fill(),s.restore(),s.strokeStyle=g(b,Math.min(.6,Z*.9)),s.lineWidth=1.1,s.lineCap="round",s.beginPath();for(let G=0;G<2600;G++){let Y=(E()-.5)*.19,ce=-.16+E()*.17;if(ce>Q(Y)-.003)continue;let xe=Math.PI/2+Math.sign(Y)*(.2+E()*.5),we=2+E()*3;s.moveTo(u(Y),p(ce)),s.lineTo(u(Y)+Math.cos(xe)*we*Math.sign(Y||1),p(ce)+Math.sin(xe)*we)}s.stroke()}let te=(i?.0088:.0066)*q,Ce=(i?.0118:.0092)*q,R=.0066*Math.min(1.2,O/.025),w=f(t.skin,e.lipColor??11554906,i?1:.35),K=w.clone().multiplyScalar(.8),W=w.clone().multiplyScalar(.95),U=w.clone().lerp(new ke(y),.07),re=w.clone().multiplyScalar(.7);v(0,$-Ce-.0034,O*.62,.0028,x(.6),.22),s.beginPath(),s.moveTo(u(-O),p($+5e-4)),s.bezierCurveTo(u(-O*.72),p($+te*.38),u(-R*1.55),p($+te*.97),u(-R),p($+te)),s.quadraticCurveTo(u(-R*.45),p($+te*.98),u(0),p($+te*.74)),s.quadraticCurveTo(u(R*.45),p($+te*.98),u(R),p($+te)),s.bezierCurveTo(u(R*1.55),p($+te*.97),u(O*.72),p($+te*.38),u(O),p($+5e-4)),s.bezierCurveTo(u(O*.5),p($-2e-4),u(.006),p($-4e-4),u(0),p($-.0011)),s.bezierCurveTo(u(-.006),p($-4e-4),u(-O*.5),p($-2e-4),u(-O),p($+5e-4)),s.closePath();let k=s.createLinearGradient(0,p($+te),0,p($));k.addColorStop(0,g(W)),k.addColorStop(1,g(K)),s.fillStyle=k,s.fill(),V>0&&(s.strokeStyle=g(w.clone().multiplyScalar(.55),.5*Math.min(1,V)),s.lineWidth=2.2,s.stroke()),s.beginPath(),s.moveTo(u(-O*.95),p($+3e-4)),s.bezierCurveTo(u(-O*.5),p($-5e-4),u(-.006),p($-7e-4),u(0),p($-.0011)),s.bezierCurveTo(u(.006),p($-7e-4),u(O*.5),p($-5e-4),u(O*.95),p($+3e-4)),s.bezierCurveTo(u(O*.85),p($-Ce*.72),u(O*.5),p($-Ce*1.06),u(0),p($-Ce)),s.bezierCurveTo(u(-O*.5),p($-Ce*1.06),u(-O*.85),p($-Ce*.72),u(-O*.95),p($+3e-4)),s.closePath(),k=s.createLinearGradient(0,p($),0,p($-Ce)),k.addColorStop(0,g(re)),k.addColorStop(.4,g(U)),k.addColorStop(1,g(w.clone().multiplyScalar(.86))),s.fillStyle=k,s.fill(),V>0&&(s.strokeStyle=g(w.clone().multiplyScalar(.55),.45*Math.min(1,V)),s.lineWidth=2.2,s.stroke()),i&&(v(.0045,$-Ce*.46,O*.33,Ce*.17,y,.75,-.08),v(-.0065,$-Ce*.52,O*.11,Ce*.08,y,.5),v(R*.95,$+te*.6,.0024,.0011,y,.45),v(-R*1.1,$+te*.55,.0016,8e-4,y,.3));let H=i?9e-4:5e-4,ie=O*(i?.55:.75);s.beginPath(),s.moveTo(u(-ie),p($-2e-4)),s.quadraticCurveTo(u(0),p($+H),u(ie),p($-2e-4)),s.quadraticCurveTo(u(0),p($-H*1.2-4e-4),u(-ie),p($-2e-4)),s.closePath(),s.fillStyle="#2a070b",s.fill(),s.strokeStyle=g(re.clone().multiplyScalar(.5)),s.lineWidth=2.5,s.lineCap="round",s.beginPath(),s.moveTo(u(-O),p($+6e-4)),s.bezierCurveTo(u(-O*.5),p($-4e-4),u(O*.5),p($-4e-4),u(O),p($+6e-4)),s.stroke();for(let b of C)v(b*O*1.02,$+7e-4,.0024,.0016,x(.9),.55);if(e.corpse){s.save(),s.translate(u(0),p(-.03)),s.scale(.086*h,.104*d);let b=s.createRadialGradient(0,0,0,0,0,1);b.addColorStop(0,"rgba(244,242,238,0.93)"),b.addColorStop(.8,"rgba(244,242,238,0.93)"),b.addColorStop(1,"rgba(244,242,238,0)"),s.fillStyle=b,s.beginPath(),s.arc(0,0,1,0,7),s.fill(),s.restore(),v(0,S.y-.03,.06,.05,9079440,.12),s.fillStyle=g(oe,.96);for(let G of C){let Y=[[-1.2,.3],[-.6,1.6],[-.25,3.2],[.15,1.9],[.75,3.4],[1,1.7],[1.55,.5],[1.15,-1.6],[.55,-1.2],[.2,-3.6],[-.2,-1.4],[-.9,-.9]];s.beginPath(),Y.forEach(([ce,xe],we)=>{let _e=u(G*(S.x+ce*T)),Ae=p(S.y+(xe>0?xe*L*.75:xe*I*1.1));we?s.lineTo(_e,Ae):s.moveTo(_e,Ae)}),s.closePath(),s.fill()}v(0,F-.003,.009,.007,oe,.9);let Q=O*1.2;s.beginPath(),s.moveTo(u(-Q),p($+te*1.3)),s.lineTo(u(Q),p($+te*1.3));for(let[G,Y]of[[1,-.012],[.75,-.04],[.5,-.016],[.22,-.05],[0,-.018],[-.22,-.05],[-.5,-.016],[-.75,-.04],[-1,-.012]])s.lineTo(u(G*Q),p($+Y));s.closePath(),s.fill()}if(e.scar){let b=S.x+T*.2,Q=[b+.006,S.y+L+.026],G=[b-.008,S.y-I-.024];s.strokeStyle=g(f(t.skin,16765128,.55),.95),s.lineWidth=6,s.lineCap="round",s.beginPath(),s.moveTo(u(Q[0]),p(Q[1])),s.lineTo(u(G[0]),p(G[1])),s.stroke(),s.strokeStyle=g(x(.8),.6),s.lineWidth=2.5;for(let Y=1;Y<6;Y++){let ce=Y/6,xe=Ue(Q[0],G[0],ce),we=Ue(Q[1],G[1],ce);s.beginPath(),s.moveTo(u(xe-.0035),p(we-.0012)),s.lineTo(u(xe+.0035),p(we+.0012)),s.stroke()}}for(let b of t.tattoos||[])if(b.spot==="mejilla"&&Vn[b.design]){let Q=.021*h;s.save(),s.translate(u(-(S.x+T*.35))-Q/2,p(S.y-I-.017)-Q/2),s.scale(Q/256,Q/256),Vn[b.design](s,Ri(b.color??1709088)),s.restore()}let ge=null;if(e.legMk){let b=go(512,512),Q=b.getContext("2d");Q.fillStyle="#000",Q.fillRect(0,0,512,512);let G=_e=>u(_e)/2,Y=_e=>p(_e)/2,ce=g(f(X,y,.55)),xe=(_e,Ae,be,Te=ce)=>{for(let[Ie,ee,le,ue,Me]of[[s,u,p,Ae,Te],[Q,G,Y,be,"#f00"]])Ie.lineCap=Ie.lineJoin="round",Ie.lineWidth=ue,Ie.strokeStyle=Me,Ie.beginPath(),_e.forEach(([ze,Je],Ye)=>Ye?Ie.lineTo(ee(ze),le(Je)):Ie.moveTo(ee(ze),le(Je))),Ie.stroke()},we=(_e,Ae,be,Te,Ie,ee)=>{for(let[le,ue,Me,ze,Je,Ye]of[[s,u,p,1,Ie,ce],[Q,G,Y,.5,ee,"#f00"]])le.lineWidth=Je,le.strokeStyle=Ye,le.beginPath(),le.ellipse(ue(_e),Me(Ae),be*h*ze,Te*d*ze,0,0,7),le.stroke()};if(e.legMk===1){s.save(),s.filter="blur(5px)",s.fillStyle=g(oe,.94);for(let _e of C)s.beginPath(),s.ellipse(u(_e*(S.x+T*.1)),p(S.y+(L-I)*.3),T*1.7*h,(L+I)*1.45*d,0,0,7),s.fill();s.beginPath(),s.moveTo(u(-.0075),p(F+.004)),s.lineTo(u(0),p(F-.0095)),s.lineTo(u(.0075),p(F+.004)),s.closePath(),s.fill(),s.restore();for(let _e of C)we(_e*(S.x+T*.1),S.y+(L-I)*.3,T*1.85,(L+I)*1.6,3.5,2.6);xe([[-.0075,F+.004],[0,F-.0095],[.0075,F+.004],[-.0075,F+.004]],3,2.2),xe([[-O*1.3,$+5e-4],[O*1.3,$+5e-4]],3,2.2);for(let _e=-3;_e<=3;_e++)xe([[_e*O*.36,$+.0085],[_e*O*.36,$-.0095]],2.6,2);for(let _e of C)xe([[_e*.08,S.y-.026],[_e*.062,F-.004],[_e*.034,F-.013]],3,2.2);xe([[.012,S.y+L+.028],[.02,S.y+L+.042],[.012,S.y+L+.052],[.024,S.y+L+.072]],2.6,2)}if(e.legMk===2){let _e=g(f(X,2754560,.35),.95);[[[0,-1,0,1],[0,.15,-.7,.9],[0,.15,.7,.9]],[[-.4,-1,-.4,1],[-.4,.6,.5,0],[.5,0,-.4,-.6]],[[0,1,.6,.3],[.6,.3,0,-.3],[0,-.3,-.6,.3],[-.6,.3,0,1],[0,-.3,.6,-1],[0,-.3,-.6,-1]]].forEach((Te,Ie)=>{let ee=(Ie-1)*.03,le=S.y+L+.034,ue=.0115;for(let[Me,ze,Je,Ye]of Te)xe([[ee+Me*ue,le+ze*ue],[ee+Je*ue,le+Ye*ue]],6,4,_e)});let be=-(S.x+T*.12);xe([[be+.002,S.y+L+.02],[be,S.y+L+.004]],6,4,_e),xe([[be-.001,S.y-I-.004],[be-.003,S.y-I-.03]],6,4,_e);for(let Te of C)for(let Ie=0;Ie<2;Ie++){let ee=Te*(S.x+T*1.45+Ie*.009),le=S.y+.002;xe([[ee,le+.008],[ee+Te*.008,le],[ee,le-.008]],5.5,3.6,_e)}}if(e.legMk===3){let _e=(Ae,be,Te,Ie)=>{let ee=.0034*Te,le=.0052*Te;for(let[ue,Me,ze,Je]of[[s,u,p,0],[Q,G,Y,1]])ue.beginPath(),ue.moveTo(Me(Ae),ze(be+le)),ue.lineTo(Me(Ae+ee),ze(be)),ue.lineTo(Me(Ae),ze(be-le)),ue.lineTo(Me(Ae-ee),ze(be)),ue.closePath(),Je?(ue.fillStyle=`rgb(255,${Math.round(Ie*255)},${Math.round(E()*255)})`,ue.fill()):(ue.fillStyle=g(f(X,y,.45)),ue.fill(),ue.lineWidth=1.6,ue.strokeStyle=g(f(X,1708080,.6)),ue.stroke(),ue.fillStyle="rgba(255,255,255,.9)",ue.beginPath(),ue.arc(Me(Ae-ee*.3),ze(be+le*.3),1.6,0,7),ue.fill())};for(let Ae of C)[-.25,.2,.62].forEach((be,Te)=>_e(Ae*(S.x+be*T),S.y-I-.0058-Te*6e-4,.8+.1*Te,E())),_e(Ae*(S.x+T*1.3),S.y+L*.2,1.1,E());[[.45,.016,1.15],[.5,.028,.9],[.53,.038,.7]].forEach(([Ae,be,Te])=>_e(-(S.x+T*Ae),S.y-I-be,Te,E()))}if(e.legMk===4){let _e=[[-.95,.2],[-.6,1.25],[.2,1.75],[1.2,1.95],[2.3,2.1],[1.55,1.05],[1.15,.2],[.6,-.9],[-.3,-1]];for(let Ae of C)for(let[be,Te,Ie,ee]of[[s,u,p,0],[Q,G,Y,1]])be.save(),be.filter=ee?"blur(3px)":"blur(6px)",be.beginPath(),_e.forEach(([le,ue],Me)=>{let ze=Te(Ae*(S.x+le*T)),Je=Ie(S.y+(ue>0?ue*L:ue*I));Me?be.lineTo(ze,Je):be.moveTo(ze,Je)}),be.closePath(),be.fillStyle=ee?"#f00":g(X,.35),be.fill(),be.restore();Q.globalCompositeOperation="lighter";for(let Ae=0;Ae<70;Ae++){let be=E()<.5?-1:1,Te=be*(S.x+(E()*3-.8)*T),Ie=S.y+(E()*2.4-.3)*L;Q.fillStyle=`rgb(0,255,${Math.round(E()*255)})`,Q.beginPath(),Q.arc(G(Te),Y(Ie),1.1+E(),0,7),Q.fill()}Q.globalCompositeOperation="source-over"}if(e.legMk===5){let _e=g(f(X,1705216,.45),.95),Ae=(Te,Ie,ee,le,ue,Me)=>{let ze=[[Te,Ie]];for(let Je=0;Je<ue;Je++)Te+=ee+(E()-.5)*.006,Ie+=le+(E()-.5)*.004,ze.push([Te,Ie]);return xe(ze,Me,Me*.7,_e),ze};for(let Te of C){let Ie=Ae(Te*(S.x+T*1.15),S.y+.002,Te*.007,.007,4,9);Ae(...Ie[2],Te*.002,.009,2,6),Ae(...Ie[1],Te*.006,-.006,2,6),Ae(Te*(S.x+T*.2),S.y-I-.004,Te*.002,-.008,2,7)}let be=Ae(.002,S.y+L+.016,.001,.011,4,9);Ae(...be[2],.009,.006,3,6),Ae(...be[1],-.009,.005,3,6)}if(e.legMk===6){for(let _e of C){let Ae=_e*(S.x+T*.95),be=S.y+.002,Te=(Ie,ee,le,ue)=>{Ie.beginPath(),Ie.moveTo(ee(Ae),le(be)),ue?Ie.bezierCurveTo(ee(Ae+_e*.01),le(be+.032),ee(Ae+_e*.042),le(be+.036),ee(Ae+_e*.036),le(be+.008)):Ie.bezierCurveTo(ee(Ae+_e*.024),le(be-.002),ee(Ae+_e*.028),le(be-.026),ee(Ae+_e*.008),le(be-.02)),Ie.closePath()};for(let Ie of[!0,!1])Te(s,u,p,Ie),s.fillStyle=g(X,.5),s.fill(),s.lineWidth=2.6,s.strokeStyle=g(f(X,1708080,.6)),s.stroke(),Te(Q,G,Y,Ie),Q.fillStyle=Ie?"rgb(255,40,0)":"rgb(255,170,0)",Q.fill()}Q.globalCompositeOperation="lighter";for(let _e=0;_e<40;_e++){let Ae=E()<.5?-1:1,be=Ae*(S.x+T*(1.1+E()*2.2)),Te=S.y+(E()*2.6-.8)*L;Q.fillStyle="rgb(0,0,"+Math.round(80+E()*175)+")",Q.beginPath(),Q.arc(G(be),Y(Te),1+E(),0,7),Q.fill()}Q.globalCompositeOperation="source-over"}for(let _e of C)Q.fillStyle="#000",Q.beginPath(),Q.ellipse(G(_e*S.x),Y(S.y+(L-I)/2),T*h*.51,(L+I)/2*d*.5,0,0,7),Q.fill();ge=new Jr(b)}let pe=new Jr(a);return pe.colorSpace=$t,pe.anisotropy=8,pe.userData.glow=ge,pe}function Pv(i,e,t,n){let r=n.eye,a=r.hw,s=h=>new ke(h),o=Av(i,e,t,n),l={uFaceTex:{value:o},uSkin:{value:s(t.skin)},uIris:{value:s(e.eyes??3811864)},uLash:{value:s(e.lash??(i?1706516:e.brow!==void 0?ei(e.brow,.75):ei(t.hair?.color??2759184,.35)))},uBrowC:{value:s(e.brow??ei(t.hair?.color??2759184,.7))},uSclera:{value:s(15130840)},uEyeA:{value:new pt(r.x,r.y,a,a*(i?.66:.56)*(e.eyeOpen??1))},uEyeB:{value:new pt(a*(i?.38:.33)*(e.lowLid??1),(i?.0028:.0012)+.001*(e.tilt??0),a*(i?.56:.47)*(e.irisK??1),e.liner??(i?1:0))},uLid:{value:new pt(.2,.2,0,0)},uGaze:{value:new pt(0,0,0,0)},uBrow:{value:new pt(0,0,0,0)},uBrowS:{value:new pt((i?.016:.011)-(e.browDrop??0),(i?.0092:.0085)*e.browThick,(i?.0042:.0022)*(.4+e.browArch)/1.1,e.lashLen??1)},uFace:{value:new pt(ar.X,ar.Y0,ar.Y1,e.lineW??(i?1:.55))},uIris2:{value:s(e.eyes2??15249440)},uIrisS:{value:new pt(e.irisStyle??0,0,0,0)},uBrowT:{value:new pt(e.browStraight??0,e.browSlit??0,e.browBushy??0,e.browLen??1)},uT:{value:0},uGlowTex:{value:o.userData.glow??Rv},uGlowS:{value:new pt(e.legMk??0,0,0,0)},uGlowA:{value:s(e.shadow??3866592)}},c=new on({color:16777215,gradientMap:vs});return c.onBeforeCompile=h=>{Object.assign(h.uniforms,l),h.vertexShader=`attribute vec2 fuv; attribute vec4 fovr; attribute float ffw;
varying vec2 vFuv; varying vec4 vOvr; varying float vFw;
`+h.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
vFuv = fuv; vOvr = fovr; vFw = ffw;`),h.fragmentShader=Cv+`
`+h.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
diffuseColor.rgb *= facePaint();`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += fEm;`)},c.customProgramCacheKey=()=>"facePaint",{mat:c,U:l}}function Lv(i,e){let t={uFaceInv:{value:new Ze},uJaw:{value:e.jaw.slice()},uNeckSh:{value:new ke().setRGB(.74,.55,.52)},uSp:{value:0},uBust:{value:0}},n=new on({color:i,gradientMap:vs});return n.onBeforeCompile=r=>{Object.assign(r.uniforms,t),r.vertexShader=`varying vec3 vWPos;
`+r.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`),r.fragmentShader=`varying vec3 vWPos; uniform mat4 uFaceInv; uniform float uJaw[13]; uniform vec3 uNeckSh;
float jawAt(float ax) { float f = clamp(ax / 0.01, 0.0, 11.999); int i = int(f); return mix(uJaw[i], uJaw[i + 1], fract(f)); }
`+r.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
  vec3 fp = (uFaceInv * vec4(vWPos, 1.0)).xyz; float ax = abs(fp.x), jy = jawAt(ax) + 0.004, dep = mix(0.034, 0.028, clamp(ax / 0.08, 0.0, 1.0));
  float nsh = (1.0 - smoothstep(jy - 0.002, jy, fp.y)) * smoothstep(jy - dep - 0.008, jy - dep + 0.002, fp.y) * smoothstep(-0.07, -0.02, fp.z) * (1.0 - smoothstep(0.075, 0.1, ax));
  diffuseColor.rgb *= mix(vec3(1.0), uNeckSh, nsh);`),If(r,{},1,[.8,.6,.56])},n.customProgramCacheKey=()=>"neckShadow",{mat:n,U:t}}function Of(i,e){let t=i.geo.attributes.position,n=i.geo.attributes.normal,r=0,a=1e9;return i.meta.forEach((s,o)=>{if(s.part!==e.part)return;let l=(s.s-e.s)**2+(Cr(s.a-e.a)*.06)**2;l<a&&(a=l,r=o)}),{c:P().fromBufferAttribute(t,r),n:P().fromBufferAttribute(n,r).normalize()}}function zf(i,e){let t=i.geo.attributes.position,n=i.geo.attributes.normal,{c:r,n:a}=Of(i,e),s=P(0,1,0).addScaledVector(a,-a.y).normalize(),o=P().crossVectors(s,a),l=e.R,c=new Set,h=P(),d=P();for(let g=0;g<t.count;g++)i.meta[g].part===e.part&&(h.fromBufferAttribute(t,g),d.fromBufferAttribute(n,g),h.distanceTo(r)<l*1.15&&d.dot(a)>.15&&c.add(i.meta[g]));let u=hn(i,g=>c.has(g),.0016).geo,p=u.attributes.position,m=u.attributes.uv;for(let g=0;g<p.count;g++)h.fromBufferAttribute(p,g).sub(r),m.setXY(g,.5+h.dot(o)/(2*l),.5+h.dot(s)/(2*l));return u}function Fv(){for(let i=0;i<22;i++){let e=new En(new an({map:We.smoke,color:10137792,transparent:!0,depthWrite:!1,opacity:Ve(.05,.11)}));e.position.set(Ve(-8,8),Ve(Ne+.3,Ne+3),Ve(-3,6)),e.scale.setScalar(Ve(3,6)),Ge.add(e),Hf.push({sp:e,v:Ve(-.15,.15),y0:e.position.y})}}function Gv(i,e,t,n){switch(i){case"intro":return e===0?[[0,40,16,"p"]]:e===1?[[0,40,8,"p"],[8,43,4,"p"],[12,45,4,"p"]]:e===2?[[0,40,8,"p"],[8,38,8,"p"]]:[40,40,43,40,40,45,43,47].map((r,a)=>[a*2,r,2,a%2?"m":"p"]);case"verse":{let r=[[0,40,1,"m"],[1,40,1,"m"],[2,40,1,"m"],[3,43,1,"p"],[4,40,1,"m"],[5,40,1,"m"],[6,45,2,"p"],[8,40,1,"m"],[9,40,1,"m"],[10,40,1,"m"],[11,47,1,"p"],[12,48,2,"p"],[14,47,2,"p"]],a=[[0,40,1,"m"],[1,40,1,"m"],[2,40,1,"m"],[3,43,1,"p"],[4,40,1,"m"],[5,40,1,"m"],[6,45,2,"p"],[8,40,1,"m"],[9,40,1,"m"],[10,43,2,"p"],[12,45,2,"p"],[14,43,1,"p"],[15,45,1,"p"]];return e%2?a:r}case"pre":{let r=[48,50,47];return e<3?[0,2,4,6,8,10,12,14].map(a=>[a,r[e],2,a%4?"m":"p"]):[[0,47,4,"p"],[4,48,4,"p"],[8,50,4,"p"],[12,52,4,"p"]]}case"chorus":{let r=[48,50,40,40,43,50,48,47],a=r[e%8],s=r[(e+1)%8];return[[0,a,3,"p"],[3,a,3,"p"],[6,a,2,"p"],[8,a,6,"p"],[14,s,2,"p"]]}case"solo":{let r=[64,67,69,71,74,76,79],s=[[0,2,4,6,8,10,12,14],[0,1,2,3,4,6,8,9,10,11,12,14],[0,2,3,4,6,8,10,11,12],[0,3,6,8,10,12]][(e*7+3)%4];return e===7?[[0,76,2,"s"],[2,74,2,"s"],[4,71,2,"s"],[6,69,2,"s"],[8,76,8,"s"]]:s.map((o,l)=>{let c=(s[l+1]??16)-o;return n.idx=Se(n.idx+(t()<.6?e%2?-1:1:t()<.5?1:-1)*(t()<.25?2:1),0,r.length-1),[o,r[n.idx],c,"s"]})}case"break":{let r=e%2?46:38;return[[0,40,3,"p"],[3,40,1,"m"],[4,40,1,"m"],[6,41,2,"p"],[8,40,1,"m"],[10,40,1,"m"],[12,r,4,"p"]]}case"outro":return e===0?[[0,40,2,"p"],[2,40,2,"p"],[4,40,2,"p"],[6,43,2,"p"],[8,45,2,"p"],[10,47,2,"p"],[12,40,4,"p"]]:[[0,40,16,"p"]]}return[]}function Vv(i,e,t){let n=[],r=(s,o)=>s.forEach(l=>n.push([l,o])),a=[0,2,4,6,8,10,12,14];switch(i){case"intro":if(e<3)return r([0],"crash"),r([0],"kick"),e===2&&(r([8,10],"tom1"),r([12,13],"tom2"),r([14,15],"ftom")),n;r([0,8,10],"kick"),r([4,12],"snare"),r(a,"hat"),e===3&&r([0],"crash");break;case"verse":r([0,3,8,10],"kick"),r([4,12],"snare"),r(a,"hat"),(e===0||e===4)&&r([0],"crash");break;case"pre":r(a,"kick"),r([4,12],"snare"),r([0,4,8,12],"hat"),e===0&&r([0],"crash");break;case"chorus":r([0,6,8,14],"kick"),r([4,12],"snare"),r(a,"ride"),e%2===0&&r([0],"crash");break;case"solo":r([0,2,8,10,11],"kick"),r([4,12],"snare"),r(a,"hat"),e%4===0&&r([0],"crash");break;case"break":return r([0,3,4,8,10],"kick"),r([8],"snare"),r([0],"crash"),r([4,12],"hat"),n;case"outro":return e===0?(r([0,2,4,6,8,10],"kick"),r([0,4,8],"snare"),r([0],"crash"),r([12,13],"tom1"),r([14,15],"ftom")):(r([0],"kick"),r([0],"crash")),n}return e===t-1&&(n=n.filter(([s,o])=>s<8||o==="kick"),r([8,9,10,11],"snare"),r([12,13],"tom1"),r([14],"tom2"),r([15],"ftom")),n}function Wv(){let i=[],e=[],t=[],n=0,r=xo(77),a={idx:2};for(let[l,c]of G1){i.push({name:l,bar0:n,t0:n*Yt,t1:(n+c)*Yt});for(let h=0;h<c;h++){let d=(n+h)*Yt;for(let[u,p,m,g]of Gv(l,h,r,a))e.push({t:d+u*wh,m:p,d:m*wh,kind:g});for(let[u,p]of Vv(l,h,c))t.push({t:d+u*wh,k:p})}n+=c}e.sort((l,c)=>l.t-c.t),t.sort((l,c)=>l.t-c.t);let s=[[],[]],o=0;for(let l of t)l.k!=="kick"&&(l.k==="snare"?s[1].push({t:l.t,d:"snare"}):l.k==="hat"?s[0].push({t:l.t,d:"hat"}):l.k==="crash"?s[0].push({t:l.t,d:"crash"}):l.k==="ride"?s[1].push({t:l.t,d:"ride"}):s[o++%2?0:1].push({t:l.t,d:l.k}));for(let l of s)for(let c=l.length-1;c>0;c--)l[c].t-l[c-1].t<.03&&l.splice(c,1);return{sections:i,notes:e,drums:t,hands:s,len:n*Yt}}async function jv(){let i=await(await fetch("https://fonts.googleapis.com/css2?family=Bangers&display=swap")).text(),e=[];for(let t of i.matchAll(/@font-face\s*{([^}]*)}/g)){let n=/url\(([^)]+)\)/.exec(t[1]),r=/unicode-range:\s*([^;]+);/.exec(t[1]);if(!n)continue;let a=new FontFace("Bangers",`url(${n[1]})`,r?{unicodeRange:r[1].trim()}:{});self.fonts.add(a),e.push(a.load())}await Promise.allSettled(e)}function Gf(i){return fi[i]||(i="violeta"),Qi[i]||(Qi[i]=new ys(fi[i],"guitar"),Qi[i].root.visible=!1,Ge.add(Qi[i].root)),Qi[i]}function hf(i,e){let t=JSON.stringify(e);return fi[i]&&JSON.stringify(fi[i])===t||(fi[i]=JSON.parse(t),Qi[i]&&(Qi[i].dispose(),delete Qi[i])),i}function cn(i,e,t,n,r,a,s=0,o=1,l="center",c=1){i.save(),i.globalAlpha=Se(c,0,1),i.translate(t,n),i.rotate(s),i.scale(o,o),i.font=`${r}px Bangers, Impact, sans-serif`,i.textAlign=l,i.textBaseline="middle",i.lineJoin="round",i.lineWidth=r*.16,i.strokeStyle="#000",i.strokeText(e,r*.06,r*.07),i.strokeText(e,0,0),i.fillStyle=a,i.fillText(e,0,0),i.restore()}function Kv(i){let e=j1,t=gs.width,n=gs.height;lo=On(lo,zt.bars&&!j.open?1:0,5,i||.016);let r=$i.cur,a=!!r&&zt.titles&&!j.open,s=lo>.002,o=a?"T"+Zt.t:s?t+"x"+n+":"+Math.round(lo*2e3):"";if(o===tu)return o!=="";if(tu=o,e.clearRect(0,0,t,n),ou.needsUpdate=!0,s){e.fillStyle="#000";let l=n*.11*lo;e.fillRect(0,0,t,l),e.fillRect(0,n-l,t,l)}return a?($v(e,t,n,r),!0):s}function $v(i,e,t,n){let r=Zt.t-n.t0,a=t/1080;if(n.type==="vs"){if(r>5){$i.cur=null;return}let s=r>4.4?Oe((r-4.4)/.6):0,o=Oe(Se(r/.5,0,1)),l=Oe(Se((r-.25)/.5,0,1)),c=r<.7?0:1+2.5*Math.max(0,1-(r-.7)/.18);cn(i,n.a.name.toUpperCase(),Ue(-e*.3,e*.27,o)-s*e*.5,t*.48,120*a,n.a.ui,-.06),cn(i,n.b.name.toUpperCase(),Ue(e*1.3,e*.73,l)+s*e*.5,t*.6,120*a,n.b.ui,-.06),c>0&&cn(i,"VS",e/2,t*.54,190*a,"#ffd23a",-.1,c,"center",1-s),cn(i,"BATALLA EN EL PATIO",e/2,t*.2,54*a,"#ffffff",0,1,"center",Se(r-1,0,1)*(1-s))}else if(n.type==="solo"){if(r>5){$i.cur=null;return}let s=r>4.4?Oe((r-4.4)/.6):0,o=Oe(Se(r/.5,0,1));cn(i,n.a.name.toUpperCase(),Ue(-e*.3,e/2,o)-s*e*.6,t*.5,130*a,n.a.ui,-.06),cn(i,"EN EL ESCENARIO",e/2,t*.22,54*a,"#ffffff",0,1,"center",Se(r-.6,0,1)*(1-s))}else if(n.type==="fin"){if(r>9){$i.cur=null;return}let s=r<.2?Ue(3,1,r/.2):1;if(cn(i,n.text,e/2,t*.36,170*a,"#ffd23a",-.07,s,"center",r>7?1-(r-7)/2:1),r>1){let o=Oe(Se((r-1)/.5,0,1));cn(i,n.w.name.toUpperCase(),e/2,t*.52,110*a,n.w.ui,-.05,o,"center",r>7?1-(r-7)/2:1)}}else if(n.type==="call"){if(r>1.8){$i.cur=null;return}let s=r<.15?Ue(2.4,1,r/.15):1+(r-.15)*.06,o=r>1.4?1-(r-1.4)/.4:1;cn(i,n.text,e/2,t*.27,130*a,n.color,-.07,s,"center",o)}else if(n.type==="ko"){if(r>11){$i.cur=null;return}let s=r<.2?Ue(3,1,r/.2):1;if(r<3.5&&cn(i,"\xA1K.O.!",e/2,t*.42,260*a,"#ffd23a",-.08,s,"center",r>3?1-(r-3)*2:1),r>3){let o=Oe(Se((r-3)/.5,0,1));cn(i,"\xA1GANA",e/2,t*.3,90*a,"#ffffff",-.05,o),cn(i,n.w.name.toUpperCase()+"!",e/2,t*.44,150*a,n.w.ui,-.05,o)}}}function va(i,e){j.view===i&&e===void 0||(j.view=i,j.zoom=1,j.yaw=e??gc(i))}function ix(i,e){if(!j.open){Lt.clearViewOffset();return}i>700?Lt.setViewOffset(i,e,Math.round(Math.min(400,i)/2),0,i,e):Lt.setViewOffset(i,e,0,Math.round(e*.26),i,e)}function Vf(){let i=j.rk,e=JSON.parse(JSON.stringify(j.L));j.tab==="tat"&&j.tat.spot==="mejilla"&&e.tattoos.length<5&&!e.tattoos.some(t=>t.spot==="mejilla")&&e.tattoos.push({design:j.tat.design,spot:"mejilla",color:j.tat.color});try{j.rk=new ys(e,"guitar")}catch(t){console.error(t);return}Ge.add(j.rk.root),j.rk.place(oc.x,oc.y,oc.z,0),j.rk.st.I=.55,i&&i.dispose(),j.prev=null,vc()}function dn(i=!0){clearTimeout(j.tm),j.tm=setTimeout(Vf,80),i&&Xn()}function Wf(i,e){Mh(j.L,i,e),i==="guitar.body"&&delete j.L.guitar.head;let t=Wl.find(r=>r[0]===i);t&&Nn[j.L.body][t[1]].find(r=>r[0]===e)?.[2]&&(Sh(j.L,i),zi("\u2605 \xA1Legendario!"));let n=i.split(".")[0];if(Zi[n]&&i===n+".type"){let r=yf(j.L.body,n,e);r.length&&Object.assign(j.L[n],r.at(-1).c)}dn()}function zi(i){let e=Mt("#edToast");e.textContent=i,e.classList.add("on"),clearTimeout(ff),ff=setTimeout(()=>e.classList.remove("on"),1800)}function nx(i){let e=j.L,t=An(i),n=Nn[i];e.name!==An(e.body).name&&(t.name=e.name),Object.assign(t,{skin:e.skin,ui:e.ui,belt:e.belt}),Object.assign(t.face,{eyes:e.face.eyes,eyes2:e.face.eyes2,brow:e.face.brow}),Object.assign(t.hair,{color:e.hair.color,color2:e.hair.color2}),t.top.color=e.top.color,t.bottom.color=e.bottom.color,t.shoes.color=e.shoes.color,t.guitar.body=e.guitar.body,t.beard&&(t.beard.color=ei(e.hair.color,.85));let r=(a,s)=>a.some(o=>o[0]===s);t.tattoos=e.tattoos.map(a=>({...a,design:r(n.tatDesign,a.design)?a.design:n.tatDesign[0][0],spot:r(n.tatSpot,a.spot)?a.spot:n.tatSpot[0][0]})),j.L=t,dn()}function Xn(){let i=j.L,e=i.body,t=Nn[e],n=e==="f";Mt("#edTabs").innerHTML=Qv.map(([h,d])=>`<button class="${j.tab===h?"on":""}" data-tab="${h}">${d}</button>`).join(""),Mt("#edViews").innerHTML=ex.map(([h,d])=>`<button class="${j.view===h?"on":""}" data-view="${h}">${d}</button>`).join("")+'<button data-rot="-1" aria-label="Girar a la izquierda">\u27F2</button><button data-rot="1" aria-label="Girar a la derecha">\u27F3</button>',document.activeElement!==Mt("#edName")&&(Mt("#edName").value=i.name);let r=(h,d)=>{let u=h.split(".")[0];return Zi[u]&&h===u+".type"&&!nc(e,u,d)},a=(h,d,u,p="p",m=ra(i,d))=>`<div class="eg"><b>${h}</b><div class="chips">${u.map(([g,f,y])=>`<button class="chip${y?" leg":""}${m===g?" on":""}${p==="p"&&m!==g&&r(d,g)?" lock":""}" data-${p}="${d}" data-v="${g}">${f}</button>`).join("")}</div></div>`,s=h=>{let d=i[h]?.type;if(!d||d==="none")return"";let u=bf(e,h,d),p=br(jl(e,h,i[h])),m=`<div class="eg"><b>Tus variantes (${u.length})</b>`+(u.length?`<div class="sws">${u.map((f,y)=>`<button class="sw${br(f)===p&&!f.venta?" on":""}${f.venta?" venta":""}" style="background:${Wh(f.c)}" data-var="${h}" data-i="${y}" aria-label="Variante ${y+1}${f.venta?" (a la venta)":""}" title="${f.venta?"A la venta en el mercado":f.copia?"De una caja":"Inicial"}"></button>`).join("")}</div>`:l("Esta pieza no est\xE1 en tu inventario: sale en las cajas."))+"</div>",g=u.find(f=>br(f)===p&&f.copia&&!f.venta);return g?m+=`<div class="sell"><span>\u{1F3EA} Vender esta variante en el mercado</span><input type="number" min="1" max="100000" step="1" value="${g.leg?1500:400}" aria-label="Precio" data-precio="${Ah(g.copia)}"><button class="chip" data-vende="${Ah(g.copia)}">Vender <i class="coin"></i></button></div>`:u.some(f=>br(f)===p&&!f.copia)&&(m+=l("Esta variante es inicial: la tiene todo el mundo y no se vende.")),u.some(f=>f.venta)&&(m+=l('\u{1F3EA} = a la venta en el mercado: no se puede usar hasta que la retires (en el Mercado de Juegos). <button class="chip" data-mercado="1">Ir al mercado</button>')),m},o=(h,d,u,p="p",m=ra(i,d))=>`<div class="eg"><b>${h}</b><div class="sws">${u.map(g=>`<button class="sw${m===g?" on":""}" style="background:${Ri(g)}" data-${p}="${d}" data-c="${g}" title="${Ri(g)}"></button>`).join("")}<label class="sw pick" title="Otro color"><input type="color" data-${p}="${d}" value="${Ri(m??0)}"></label></div></div>`,l=h=>`<div class="ehint">${h}</div>`,c="";if(j.tab==="cuerpo")c=a("Cuerpo","body",[["m","\u2642 Hombre"],["f","\u2640 Mujer"]])+l("Cada cuerpo tiene su propio cat\xE1logo: al cambiarlo, la ropa, el peinado y los accesorios pasan a los de ese cuerpo.")+o("Piel","skin",Et.skin)+o("Color del nombre","ui",Et.ui)+`<div class="eg"><b>Partir desde</b><div class="chips">${["violeta","rex","kid"].map(h=>`<button class="chip" data-base="${h}">${fi[h].name}</button>`).join("")}<button class="chip" data-blank="1">\u271A En blanco</button></div></div>`+l("Tu rockero toca de fondo en PRO HERO (act\xEDvalo en Ajustes) y en las salas se enfrenta al de tu rival.");else if(j.tab==="cara")c=a("Forma de la cara","face.faceShape",t.faceShape)+a("Forma de los ojos","face.eyeShape",t.eyeShape)+a("Tipo de ojo","face.eyeStyle",t.eyeStyle)+o("Color de ojos","face.eyes",Et.eyes),["degradado","estrella","anillo","hetero","eclipse","galaxia","latido","vortice","prisma"].includes(i.face.eyeStyle)&&(c+=o(i.face.eyeStyle==="hetero"?"Color del otro ojo":"Segundo color del ojo","face.eyes2",Et.eyes)),c+=a("Cejas","face.browStyle",t.browStyle)+o("Color de cejas","face.brow",Et.brow)+a(n?"Maquillaje":"Pintura","face.mkStyle",t.mkStyle),["natural","ahumado","gotico","glam","estrellaMk","guerra","calaNeon","runas","cristales","aurora","grietas","mariposaMk"].includes(i.face.mkStyle)&&(c+=o(["calaNeon","runas","cristales","aurora","grietas","mariposaMk"].includes(i.face.mkStyle)?"Color del brillo":i.face.mkStyle==="guerra"?"Color de la pintura":i.face.mkStyle==="estrellaMk"?"Color de la estrella":"Color de la sombra","face.mkColor",Et.mk)),c+=n?o("Labios","face.lipColor",Et.lips):a("Barba","beard.type",t.beard)+(i.beard.type!=="none"?o("Color de barba","beard.color",Et.brow.concat(Et.hair.slice(4,10))):"");else if(j.tab==="pelo")c=a("Peinado","hair.style",t.hair)+(i.hair.style!=="bald"?o("Color principal","hair.color",Et.hair)+o("Reflejos","hair.color2",Et.hair):l("Rapado: sin mechones, solo la cabeza.")),["pigtails","ponytail","odango"].includes(i.hair.style)&&(c+=o(i.hair.style==="ponytail"?"Color de la liga":"Adornos","hair.accent",Et.cloth)),i.hair.style==="pigtails"&&(c+=o("Cintas","hair.ribbon",Et.cloth));else if(j.tab==="ropa")c=a("Torso","top.type",t.top)+s("top"),c+=a(n?"Faldas y pantalones":"Pantalones","bottom.type",t.bottom)+s("bottom"),c+=o("Cintur\xF3n","belt",Et.cloth),n&&(c+=a("Medias","legwear.type",t.legwear)+s("legwear")),c+=a("Botas y zapatos","shoes.type",t.shoes)+s("shoes")+a("Guantes","gloves.type",t.gloves)+s("gloves");else if(j.tab==="guitarra")c=a("Modelo","guitar.type",t.guitar)+s("guitar");else if(j.tab==="acc"){for(let[h,d]of[["necklace","Collar"],["earrings","Aros"],["bracelets","Pulseras"]])c+=a(d,h+".type",t[h])+s(h);(i.top.type==="jacket"||i.top.type==="chaquetaNeon")&&i.bracelets.type!=="none"&&(c+=l("Los pu\xF1os de la chaqueta tapan las pulseras.")),["long","longF"].includes(i.hair.style)&&i.earrings.type!=="none"&&(c+=l("Con el pelo largo los aros quedan casi tapados."))}else if(j.tab==="tat"){let h=j.tat,d=(u,p)=>(u.find(m=>m[0]===p)||[p,p])[1];t.tatDesign.some(u=>u[0]===h.design)||(h.design=t.tatDesign[0][0]),t.tatSpot.some(u=>u[0]===h.spot)||(h.spot=t.tatSpot[0][0]),c=`<div class="eg"><b>Tus tatuajes (${i.tattoos.length}/5)</b>`+(i.tattoos.length?i.tattoos.map((u,p)=>`<div class="tatl"><i style="background:${Ri(u.color)}"></i><span>${d(t.tatDesign,u.design)} \xB7 ${d(t.tatSpot,u.spot)}</span><button class="chip" data-tatdel="${p}" aria-label="Quitar">\u2715</button></div>`).join(""):l("A\xFAn no tiene tatuajes. Elige dise\xF1o, lugar y color, y agr\xE9galo."))+"</div>",c+=a("Dise\xF1o","design",t.tatDesign,"tp",h.design)+a("D\xF3nde","spot",t.tatSpot,"tp",h.spot)+o("Color","color",Et.ink,"tp",h.color),c+=`<button class="add" data-tatadd="1" ${i.tattoos.length>=5?"disabled":""}>\u2795 Agregar tatuaje</button>`+l("La ropa tapa los tatuajes que quedan debajo.")}else if(j.tab==="cajas"){c=`<div class="coins"><i class="coin"></i> <b>${Math.max(0,ai.coins).toLocaleString("es")}</b> monedas</div><div class="boxc"><div class="boxi">\u{1F4E6}</div><div><b>Caja de ${n?"rockera":"rockero"}</b><span>Una prenda, guitarra o accesorio de ${n?"mujer":"hombre"} con colores al azar.<br>\u2605 Legendario: 1 de cada 10.</span></div></div><button class="add" data-box="1" ${ai.coins<pa||Ct.on||Ct.pidiendo||ai.parada?"disabled":""}>\u{1F4E6} Abrir caja \xB7 ${pa} <i class="coin"></i></button>`+(ai.parada?l("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar."):ai.coins<pa?l(`Te faltan ${(pa-Math.max(0,ai.coins)).toLocaleString("es")} monedas: juega, consigue logros o reclama la recompensa diaria.`):""),c+=`<div class="eg"><b>Tu colecci\xF3n (${n?"mujer":"hombre"})</b>`+Object.keys(Zi).filter(d=>t[d]?.length).map(d=>{let u=t[d].filter(f=>f[0]!=="none"),p=u.filter(f=>nc(e,d,f[0])).length,m=u.filter(f=>f[2]),g=m.filter(f=>nc(e,d,f[0])).length;return`<div class="colr"><span>${Zi[d].ic} ${Zi[d].n}</span><i><u style="width:${p/u.length*100}%"></u></i><em>${p}/${u.length} \xB7 \u2605${g}/${m.length}</em></div>`}).join("")+"</div>";let h=(ai.last||[]).map((d,u)=>[d,u]).filter(([d])=>d.b===e);h.length&&(c+='<div class="eg"><b>\xDAltimos premios</b><div class="chips">'+h.map(([d,u])=>`<button class="chip${d.leg?" leg":""}" data-lasti="${u}" title="Equipar"><i class="dot" style="background:${Wh(d.c)}"></i>${Ah(aa(d.b,d.k,d.t)?.[1]??d.t)}</button>`).join("")+"</div></div>"),c+=l(`Cajas abiertas: ${ai.opened}. Si sale una pieza repetida con los mismos colores, te devuelve monedas (${Th.comun}, o ${Th.leg} si es legendaria). Lo que sacas es tuyo: lo puedes vender en el mercado.`)}["ropa","guitarra","acc"].includes(j.tab)&&(c=l("\u{1F512} = a\xFAn no la tienes: sale en las <b>\u{1F4E6} Cajas</b>, con sus propios colores.")+c),j.tab!=="cuerpo"&&j.tab!=="cajas"&&(c=l('<span style="color:#ffd23a">\u2605 Legendario</span>: brilla y tiene animaci\xF3n propia. Al elegirlo se cargan sus colores.')+c),Mt("#edPane").innerHTML=c}function nu(i){let e=tx[i];e&&(j.focus=i,i==="mejilla"?va("cara",e[1]):(j.view="tat",j.zoom=1,j.yaw=e[1]))}function vc(){let i=j.rk;if(j.prev){for(let r of j.prev)r.removeFromParent(),r.geometry.dispose();j.prev=null}if(!i||!j.open||j.tab!=="tat"||j.L.tattoos.length>=5||j.L.tattoos.some(r=>r.spot===j.tat.spot&&r.design===j.tat.design&&r.color===j.tat.color))return;let e=Yh[j.tat.spot];if(!e||!Vn[j.tat.design])return;let t=zf(i.src,e),n={transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-6};j.prevMat??=new on({...n,gradientMap:vs}),j.ringMat??=new Pt({...n,polygonOffsetFactor:-4,polygonOffsetUnits:-8,toneMapped:!1,map:Lr("tatRing",()=>ft(256,256,r=>{r.strokeStyle="#ffd23a",r.lineWidth=9,r.setLineDash([20,13]),r.beginPath(),r.arc(128,128,116,0,7),r.stroke()}))}),j.prevMat.map=Bf(j.tat.design,j.tat.color),j.prevMat.needsUpdate=!0,j.prev=[i.skin(t,j.prevMat,0),i.skin(t,j.ringMat,0)]}function jf(i){j.L.body!==i.b||!j.L[i.k]||!nc(i.b,i.k,i.t)||(Object.assign(j.L[i.k],{type:i.t},i.c),va(iu(i.k+".type")),dn())}async function rx(){if(j.saving)return;j.L.name=(Mt("#edName").value||"").trim().slice(0,24)||(j.L.body==="f"?"Rockera sin nombre":"Rockero sin nombre");let i=JSON.parse(JSON.stringify(j.L));j.saving=!0,Mt("#edSave").disabled=!0;try{await bs.guarda?.(i),j.saved=JSON.stringify(i),zi("\xA1Guardado!")}catch(e){zi(e?.message||"No se pudo guardar")}finally{j.saving=!1,Mt("#edSave").disabled=!1}}async function ax(i,e){let t=[...document.querySelectorAll("#edPane [data-precio]")].find(r=>r.dataset.precio===i),n=Math.round(+(t?.value||0));if(!(n>=1&&n<=1e5)){zi("El precio va de 1 a 100.000 monedas");return}if(confirm(`\xBFPoner esta pieza a la venta por ${n.toLocaleString("es")} monedas? Mientras est\xE9 en el mercado no la puedes usar.`)){e.disabled=!0;try{await bs.vende?.(i,n),zi("\u{1F3EA} \xA1A la venta en el mercado!")}catch(r){zi(r?.message||"No se pudo vender"),e.disabled=!1}}}function sx(i){j.open=!0,j.key=null,j.L=i?_r(i):An("f"),j.saved=JSON.stringify(j.L),Object.assign(j,{tab:"cuerpo",view:"cuerpo",yaw:.35,zoom:1,mt0:0,snap:!0,prev:null});for(let e in Qi)Qi[e].root.visible=!1;Wn.root.visible=jn.root.visible=$e.micSet.visible=!1;for(let e of Hn.all)e.visible=!1;$i.cur=null,ma.stop(),Mt("#editor").classList.remove("off"),Mt("#edViews").classList.remove("off"),Vf(),Xn(),xa()}function ox(){j.open&&j.saved!==JSON.stringify(j.L)&&!confirm("Tienes cambios sin guardar. \xBFSalir igual?")||(lc(),bs.cerrar?.())}function lc(){cc(!0),clearTimeout(j.tm),j.open=!1,j.rk&&(j.rk.dispose(),j.rk=null),Mt("#editor").classList.add("off"),Mt("#edViews").classList.add("off"),Mt("#boxUI").className="",Wn.root.visible=jn.root.visible=$e.micSet.visible=!0;for(let i of Hn.all)i.visible=!0;xa()}function lx(i){let e=j.rk;if(!e)return;let t=j.view==="tat"&&e.tatMk?.[j.focus],n=t?{l:t.getWorldPosition(P()),d:.9,h:.06,fov:32}:(uc[j.view]||uc.cuerpo)(e),r=j.snap?1:1-Math.exp(-6*Math.max(i,.016));j.snap&&(j.cl.copy(n.l),j.cd=n.d*j.zoom,j.ch=n.h*j.zoom,j.cyaw=j.yaw),j.snap=!1,j.cl.lerp(n.l,r),j.cd=Ue(j.cd,n.d*j.zoom,r),j.ch=Ue(j.ch,n.h*j.zoom,r),j.cyaw=Ue(j.cyaw,j.yaw,Math.min(1,r*1.6)),Lt.position.set(j.cl.x+Math.sin(j.cyaw)*j.cd,j.cl.y+j.ch,j.cl.z+Math.cos(j.cyaw)*j.cd),Lt.lookAt(j.cl),Ct.shake>.001&&Lt.position.add(P(Ve(-1,1),Ve(-1,1),Ve(-1,1)).multiplyScalar(Ct.shake*.035));let a=Ue(Lt.fov,n.fov,r);Math.abs(a-Lt.fov)>.001&&(Lt.fov=a,Lt.updateProjectionMatrix()),Ni.u.uScale.value=fo*si.getPixelRatio()/(2*Math.tan(dh.degToRad(Lt.fov)/2)),j.prevMat&&(j.prevMat.opacity=.6+.3*Math.sin(Zt.t*5))}function hx(){let i=new ht,e=new ht;i.add(e),i.position.copy(Xf),i.rotation.y=-.3;let t=Ee(13144666),n=Ee(15257494),r=Ee(5912600,{side:di}),a=new Pt({visible:!1});he(e,new Xe(Li,gi,mi).translate(0,gi/2,0),[t,t,a,t,t,t],{outline:.012}),he(e,new Xe(Li-.012,gi-.006,mi-.012).translate(0,gi/2,0),[r,r,a,r,r,r],{outline:0});for(let y of[1,-1])he(e,new Xe(.11,.15,.004),n,{pos:[0,gi-.075,y*(mi/2+.002)],outline:0});let s=new yt(new pi(.4,.165),new on({gradientMap:fc,transparent:!0,map:ft(400,165,(y,x,v)=>{y.fillStyle="#f4e6c8",y.beginPath(),y.roundRect(5,5,x-10,v-10,14),y.fill(),y.lineWidth=6,y.strokeStyle="#1a1020",y.stroke(),y.textAlign="center",y.textBaseline="middle",y.fillStyle="#d4231a",y.font="66px Bangers, Impact, sans-serif",y.fillText("\u26A1ROCK BOX\u26A1",x/2,v*.43),y.font="900 21px Rubik, system-ui, sans-serif",y.fillStyle="#1a1020",y.fillText("FR\xC1GIL \xB7 ESTE LADO ARRIBA \u2191",x/2,v*.8)})}));s.position.set(0,.125,mi/2+.003),e.add(s);let o=[],l=(y,x,v,E,S)=>{let T=new ht;T.position.set(...x),e.add(T),he(T,y,t,{outline:.008}),S&&he(T,new Xe(.11,.004,mi/2-.004).translate(0,.014,S*mi/4),n,{outline:0}),o.push({pv:T,axis:v,sgn:E})};l(new Xe(Li*.46,.01,mi*.96).translate(-Li*.23,.005,0),[Li/2,gi,0],"z",-1),l(new Xe(Li*.46,.01,mi*.96).translate(Li*.23,.005,0),[-Li/2,gi,0],"z",1),l(new Xe(Li,.012,mi/2).translate(0,.006,-mi/4),[0,gi+.01,mi/2],"x",1,-1),l(new Xe(Li,.012,mi/2).translate(0,.006,mi/4),[0,gi+.01,-mi/2],"x",-1,1);let c={transparent:!0,depthWrite:!1,blending:ln,toneMapped:!1},h=new Pt({...c,opacity:0});for(let[y,x,v,E]of[[Li*.98,.018,0,0],[Li,.012,0,mi/2],[Li,.012,0,-mi/2],[.012,mi,Li/2,0],[.012,mi,-Li/2,0]]){let S=new yt(new Xe(y,.022,x),h);S.position.set(v,gi+.012,E),e.add(S)}let d=new En(new an({...c,map:We.glow,opacity:0}));d.position.set(0,gi+.06,0),e.add(d);let u=new Pt({...c,side:Vt,opacity:0,map:Lr("boxRay",()=>ft(16,128,(y,x,v)=>{let E=y.createLinearGradient(0,v,0,0);E.addColorStop(0,"rgba(255,255,255,1)"),E.addColorStop(.35,"rgba(255,255,255,.45)"),E.addColorStop(1,"rgba(255,255,255,0)"),y.fillStyle=E,y.fillRect(0,0,x,v);let S=y.createLinearGradient(0,0,x,0);S.addColorStop(0,"rgba(0,0,0,1)"),S.addColorStop(.5,"rgba(0,0,0,0)"),S.addColorStop(1,"rgba(0,0,0,1)"),y.globalCompositeOperation="destination-out",y.fillStyle=S,y.fillRect(0,0,x,v)}))}),p=[];for(let y=0;y<9;y++){let x=new yt(new pi(.05+y%3*.025,1).translate(0,.5,0),u);x.position.set(y<5?(y-2)*.1:0,gi+.012,y<5?0:(y-7)*.12),x.rotation.set(0,y*1.1,(y*7%5-2)*.22),x.userData.ph=y*1.7,e.add(x),p.push(x)}let m=new yt(new Ke(.34,.2,2.8,32,1,!0).translate(0,1.4,0),new qt({...c,side:Vt,uniforms:{uC:{value:new ke},uA:{value:0},uT:{value:0}},vertexShader:"varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }",fragmentShader:`uniform vec3 uC; uniform float uA, uT; varying vec2 vUv; varying vec3 vN, vV;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float st = 0.65 + 0.35 * sin(vUv.x * 50.0 + uT * 4.0) * sin(vUv.x * 23.0 - uT * 2.0);
        float a = f * f * (1.0 - vUv.y) * (1.0 - vUv.y) * st * uA; gl_FragColor = vec4(uC * 1.6, clamp(a, 0.0, 1.0)); }`}));m.position.y=gi*.7,m.scale.y=.001,i.add(m);let g=new En(new an({...c,map:We.glow,opacity:0}));g.scale.setScalar(1.5),i.add(g);let f=new yt(new pi(.42,.58),new Pt({transparent:!0,side:Vt,toneMapped:!1,depthWrite:!1}));return f.renderOrder=8,f.visible=!1,i.add(f),{g:i,body:e,flaps:o,leakM:h,glow:d,rayM:u,rays:p,beam:m,halo:g,card:f,gtr:null}}function ux(i){let e=i.v,t=e.leg,n=aa(e.b,e.k,e.t),r=Zi[e.k];return ft(360,500,(a,s,o)=>{let l=(g,f,y,x,v)=>{a.beginPath(),a.roundRect(g,f,y,x,v)},c=a.createLinearGradient(0,0,s,o);(t?["#fff4b0","#ffb02a","#ff6a1a","#ffd23a"]:["#8ad8ff","#c07bff","#4a7aff","#8ad8ff"]).forEach((g,f,y)=>c.addColorStop(f/(y.length-1),g)),l(6,6,s-12,o-12,34),a.fillStyle=c,a.fill(),a.lineWidth=8,a.strokeStyle="#000",a.stroke(),a.save(),l(26,26,s-52,o-52,22),a.clip();let h=a.createRadialGradient(s/2,200,10,s/2,200,320);h.addColorStop(0,t?"#8a4a10":"#2e2e7a"),h.addColorStop(1,t?"#2a0c18":"#120a26"),a.fillStyle=h,a.fillRect(0,0,s,o),a.globalAlpha=.2,a.fillStyle=t?"#ffd23a":"#8ad8ff";for(let g=0;g<16;g++){let f=g/16*Math.PI*2;a.beginPath(),a.moveTo(s/2,200),a.arc(s/2,200,420,f,f+Math.PI/30),a.fill()}a.globalAlpha=1,a.restore(),l(26,26,s-52,o-52,22),a.lineWidth=5,a.strokeStyle="#000",a.stroke(),a.textAlign="center",a.textBaseline="middle",a.lineJoin="round";let d=t?"\u2605 LEGENDARIO \u2605":i.dup?"REPETIDO":"\xA1NUEVO!";a.font="40px Bangers, Impact, sans-serif",a.lineWidth=7,a.strokeStyle="#000",a.fillStyle=t?"#ffd23a":"#8ad8ff",a.strokeText(d,s/2,66),a.fillText(d,s/2,66),a.font='128px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',a.fillText(r.ic,s/2,200);let u=Object.values(e.c);u.forEach((g,f)=>{a.beginPath(),a.arc(s/2+(f-(u.length-1)/2)*46,314,17,0,7),a.fillStyle=Ri(g),a.fill(),a.lineWidth=4,a.strokeStyle="#000",a.stroke()}),a.font="900 31px Rubik, system-ui, sans-serif";let p=[],m="";for(let g of(n?.[1]??e.t).split(" ")){let f=m?m+" "+g:g;m&&a.measureText(f).width>s-80?(p.push(m),m=g):m=f}p.push(m),p.forEach((g,f)=>{let y=378+f*36;a.lineWidth=7,a.strokeStyle="#000",a.strokeText(g,s/2,y),a.fillStyle="#fff",a.fillText(g,s/2,y)}),a.font="700 19px Rubik, system-ui, sans-serif",a.fillStyle="#c9b8ec",a.fillText(r.n.toUpperCase(),s/2,o-52)})}async function qf(){if(Ct.on||Ct.pidiendo||!j.open)return;if(ai.parada||ai.coins<pa){zi("No te alcanzan las monedas");return}Ct.pidiendo=!0,Mt("#editor").classList.add("busy"),zi("\u{1F4E6} Comprando la caja\u2026");let i=null;try{i=await bs.abreCaja?.(j.L.body)}catch(t){zi(t?.message||"No se pudo abrir la caja")}finally{Ct.pidiendo=!1,Mt("#editor").classList.remove("busy")}if(!i||!j.open){j.open&&Xn();return}let e=Ct.parts??=hx();if(Object.assign(Ct,{on:!0,t:0,res:i,open:!1,shown:!1,skip:null,shake:0,closeT:-1,camY:0,landed:!1}),e.g.scale.setScalar(1),e.beam.scale.y=.001,e.beam.material.uniforms.uA.value=0,e.card.visible=!1,e.halo.material.opacity=0,e.card.material.map?.dispose(),e.card.material.map=ux(i),e.card.material.needsUpdate=!0,e.gtr&&e.gtr.removeFromParent(),e.gtr=null,i.v.k==="guitar"){let t=new ht,n=wf({type:i.v.t,...i.v.c});n.g.position.x=-.42,t.add(n.g),t.visible=!1,e.g.add(t),e.gtr=t}Ge.add(e.g),j.view="caja",j.zoom=1,j.yaw=-.4,Mt("#editor").classList.add("busy"),Mt("#edViews").classList.add("off"),Mt("#boxUI").className="",Xn(),zi("\u{1F4E6} Toca la pantalla para abrirla ya")}function dx(i){let e=Ct;if(!e.on)return;let t=e.parts,n=e.res.v.leg,r=n?16761402:8050943,a=.45,s=.95,o=e.skip??2.5;e.t+=i;let l=e.t,c=(f,y,x)=>t.g.localToWorld(P(f,y,x)),h=0,d=1,u=0,p=0,m=0,g=0;if(l<a){let f=l/a;h=2.6*(1-f*f),d=1.08}else if(l<s&&!e.open){let f=(l-a)/(s-a);if(d=1-.26*Math.exp(-5*f)*Math.cos(f*15),h=.09*Math.max(0,Math.sin(f*Math.PI*1.3))*(1-f),!e.landed){e.landed=!0,e.shake=.6;for(let y=0;y<6;y++)ms.puff(c(Ve(-.35,.35),.05,Ve(-.35,.35)),{life:1.2,rise:.25,size:.5,op:.35,color:12101776})}}else if(!e.open){let f=Se((l-s)/Math.max(.01,o-s),0,1),y=(.025+.085*f*f)*(n?1.35:1);p=y*Math.sin(l*41),u=y*.6*Math.sin(l*33+1),h=Math.max(0,Math.sin(l*11))*.045*f*f,d=1+.04*Math.sin(l*22)*f,m=.16*f*Math.abs(Math.sin(l*17)),g=.3+.9*f,e.shake=Math.max(e.shake,.08*f),ct()<f*(n?.8:.35)&&Ni.emit(c(Ve(-.2,.2),gi+.03,Ve(-.2,.2)),1,{color:r,color2:16777215,speed:.6,dir:P(0,1.6,0),life:.7,size:.035,grav:-1,drag:1})}if(l>=o&&!e.open){e.open=!0,e.tOpen=l,e.shake=n?1.1:.7;let f=c(0,gi+.1,0);Ni.emit(f,n?170:90,{color:r,color2:16777215,speed:2.6,dir:P(0,2.8,0),life:1.3,size:.05,grav:-3,drag:1.2}),n&&(Ni.emit(f,70,{color:16742954,color2:16765498,speed:1.4,dir:P(0,4.5,0),life:1.6,size:.06,grav:-2,drag:.8}),ma.burst());for(let y=0;y<4;y++)ms.puff(f.clone().add(P(Ve(-.2,.2),0,Ve(-.2,.2))),{life:1.4,rise:.6,size:.7,op:.3,color:n?16767136:13162751})}if(e.open){let f=l-e.tOpen;m=2.35*(1-Math.exp(-f*7)*Math.cos(f*13)),g=Math.max(0,1-f*2);let y=Se(f*2.2,0,1);t.beam.scale.y=Math.max(.001,1-Math.pow(1-y,3)),t.beam.material.uniforms.uA.value=(n?1.25:.9)*(1-.35*Se(f-.6,0,1));let x=Se((f-.12)/1,0,1),v=1+2.70158*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2),E=t.card,S=gi*.4+v*1.05+(x>=1?Math.sin(l*2.2)*.025:0);if(E.visible=!0,E.position.set(0,S,0),E.scale.setScalar(Math.max(.01,.25+.75*v)),E.quaternion.copy(t.g.quaternion).invert().multiply(Lt.quaternion),E.rotateY((1-x)*Math.PI*4),t.halo.position.set(0,S,-.04),t.halo.material.opacity=(n?.95:.6)*x,t.halo.material.color.set(r),t.halo.scale.setScalar((n?1.9:1.4)*(1+.05*Math.sin(l*5))),t.gtr){let T=Se((f-.3)/1,0,1),C=1-Math.pow(1-T,3);t.gtr.visible=T>0,t.gtr.position.set(.05,gi*.5+C*.62,.28),t.gtr.rotation.set(0,l*1.4,.55),t.gtr.scale.setScalar(.2+.5*C)}e.camY=.3*v,ct()<.35&&Ni.emit(c(Ve(-.15,.15),gi,Ve(-.15,.15)),1,{color:r,color2:16777215,speed:.3,dir:P(0,1.4,0),life:1.2,size:.03,grav:.3,drag:.5}),f>1.25&&!e.shown&&(e.shown=!0,px())}for(let f of t.flaps)f.pv.rotation[f.axis]=f.sgn*m*(f.axis==="z"?.9:1);t.body.position.y=h,t.body.scale.set(1/Math.sqrt(d),d,1/Math.sqrt(d)),t.body.rotation.set(u,0,p),t.leakM.opacity=g,t.leakM.color.set(r),t.rayM.opacity=g*.85,t.rayM.color.set(r);for(let f of t.rays)f.scale.y=Math.max(.001,g*(.35+.3*Math.abs(Math.sin(l*9+f.userData.ph))));if(t.glow.material.opacity=g*.9,t.glow.material.color.set(r),t.glow.scale.setScalar(.5+.6*g+.05*Math.sin(l*30)),t.beam.material.uniforms.uT.value=l,t.beam.material.uniforms.uC.value.set(r),e.shake=Math.max(0,e.shake-i*2.5),e.closeT>=0){e.closeT+=i;let f=Se(e.closeT/.35,0,1);t.g.scale.setScalar(Math.max(.001,1-f*f)),f>=1&&Yf()}}function px(){let{v:i,dup:e,refund:t}=Ct.res,n=aa(i.b,i.k,i.t),r=Zi[i.k],a=Mt("#boxUI");a.className="on"+(i.leg?" leg":""),a.innerHTML=`<div class="rar" style="color:${i.leg?"#ffd23a":"#8ad8ff"}">${i.leg?"\u2605 \xA1LEGENDARIO! \u2605":e?"Repetido":"\xA1Nuevo!"}</div><div class="nm">${n?.[1]??i.t}</div><div class="sub">${r.ic} ${r.n} \xB7 <i class="dot" style="background:${Wh(i.c)}"></i>${e?`ya la ten\xEDas as\xED: +${t} <i class="coin"></i>`:"nueva en tu inventario"}</div><div class="bt"><button class="hot" data-act="equip">Equipar</button><button data-act="again" ${ai.coins<pa||ai.parada?"disabled":""}>Abrir otra \xB7 ${pa} <i class="coin"></i></button><button data-act="close">Listo</button></div>`}function cc(i){Ct.on&&(Mt("#boxUI").className="",i?Yf():Ct.closeT<0&&(Ct.closeT=0))}function Yf(){let i=Ct.parts;Ct.on=!1,Ct.closeT=-1,Ct.shake=0,i.g.removeFromParent(),i.g.scale.setScalar(1),ma.stop(),Mt("#editor").classList.remove("busy"),Mt("#edViews").classList.remove("off"),j.view==="caja"&&va("cuerpo",gc("cuerpo")),j.open&&Xn()}function dc(i){Zt.t+=i;let e=Zt.t;mc.value=e;let t=j.open;t&&(j.mt0+=i,j.mt0>12&&(j.mt0-=12,j.rk&&(j.rk.st.riffPtr=0)));let n=t?9+j.mt0:_t.mt(),r=n/vi,a=(r%1+1)%1,s=us.sections.find(m=>n>=m.t0&&n<m.t1)||us.sections[us.sections.length-1],o=_t.ko?.9:au[s.name],l=Math.floor(n/Yt);!t&&l!==_t.lastBar&&i>0&&(_t.lastBar=l,_t.onBar(l,s,n),Ki.onBar(l,s));let c={mt:n,beat:r,bp:a,notes:us.notes,hands:us.hands,vocal:!t&&!_t.ko&&["verse","pre","chorus","outro","break"].includes(s.name)&&r%8<6.5,lookTo:_t.ko?_t.winner===0?-.5:.5:0};i>0&&!t&&_t.update(i);let h=us.drums;for(_t.visPtr>0&&h[_t.visPtr-1].t>n&&(_t.visPtr=0);_t.visPtr<h.length&&h[_t.visPtr].t<=n;){let m=h[_t.visPtr++];m.k==="kick"&&(Ji=1),m.k==="crash"&&(co=1,$e.cym[1].rotation.x=$e.cym[1].userData.r0+.25),m.k==="snare"&&($e.cym[0].rotation.x=$e.cym[0].userData.r0+.08)}_t.ko&&(Ji=Math.max(Ji,Math.exp(-a*6)*.8)),Ji=Math.max(0,Ji-i*7),co=Math.max(0,co-i*2.2),Rr=Math.max(0,Rr-i*2.5);for(let m of $e.cym)m.rotation.x=On(m.rotation.x,m.userData.r0,6,i);$e.kick.scale.setScalar(1+Ji*.02);let d=t?j.rk?[j.rk]:[]:xi()?[Bi(),jn]:[Bi(),Fn(),Wn,jn];for(let m of d)m.st.I=On(m.st.I,t?.62:o,2,i);if(i>0)for(let m of d)m.update(e,n,i,c);if(i>0&&s.name==="chorus"&&n-s.t0<i*1.5)for(let m of da)m.fire(1.1);if(s.name==="solo"&&i>0&&ct()<.5)for(let m of[-6.6,6.6])Ni.emit(P(m,Ne+.3,2.7),2,{color:16765056,speed:1.2,dir:P(0,5.5,.3),life:1.4,size:.045,grav:-7,drag:.4});let u=0;for(let m of da)u=Math.max(u,m.update(e));Hn.update(e,c,Se(.4+o*.5+co*.2+(St.on?St.hype*.3:0),0,1.3),xi()?0:_t.mom),Ni.update(i),Ff.update(i),ms.update(i),ma.update(i,e);for(let m of Hf)m.sp.position.x+=m.v*i,m.sp.position.x>9&&(m.sp.position.x=-9),m.sp.position.x<-9&&(m.sp.position.x=9),m.sp.position.y=m.y0+Math.sin(e*.2+m.v*30)*.2;let p=Math.max(co,Rr*.8);gf.set(_t.mom>=0||xi()?fi[zt.L].ui:fi[zt.Rr].ui),vf.set(16773296).lerp(gf,Math.min(.55,Math.abs(_t.mom)*.6));for(let m of $e.cans){let g=t&&j.rk?j.rk.root.position:xi()||m.tgt==="p1"?Bi().root.position:m.tgt==="p2"?Fn().root.position:Wn.root.position;m.g.lookAt(g.x+Math.sin(e*.7+m.g.position.x)*.4,g.y+1.1,g.z+Math.cos(e*.6+m.g.position.x)*.3),m.beam.material.uniforms.uI.value=m.base*(.75+.6*Ji+.8*p),m.beam.material.uniforms.uColor.value.copy(vf),m.glow.material.opacity=.45+.35*Ji}$e.lights.spotL.target.position.copy(t&&j.rk?j.rk.root.position:Bi().root.position).add(P(0,1,0)),$e.lights.spotR.target.position.copy(t&&j.rk?j.rk.root.position:xi()?Bi().root.position:Fn().root.position).add(P(0,1,0)),$e.lights.spotL.intensity=2+1.2*Ji+2*p+Math.max(0,_t.mom)*1.2,$e.lights.spotR.intensity=2+1.2*Ji+2*p+Math.max(0,-_t.mom)*1.2,$e.lights.key.intensity=1.7+.9*p,t&&($e.lights.spotL.intensity=$e.lights.spotR.intensity=1),$e.lights.fx.intensity=Rr*14,$e.lights.under.intensity=5+Math.sin(e*13)*.6+Math.sin(e*7.3)*.5+u*4,$e.lights.fire.intensity=6+Math.sin(e*17)*1+Math.sin(e*9.1)*.8,su.strength=t?.3:.42+.3*p+.1*Ji+u*.15;for(let m of $e.lanterns)m.pivot.rotation.set(Math.sin(e*.9+m.ph)*.06,0,Math.sin(e*.7+m.ph)*.08);for(let m of $e.cones)m.position.z=.38+Ji*.045;for(let m of $e.fireSprites){let g=(e*m.sp+m.ph)%1;m.s.position.set(m.x*(1-g),.25+g*1.6,m.z*(1-g)),m.s.scale.setScalar((1-g)*1.1+.2),m.s.material.opacity=(1-g)*.9}if(Gh+=i,Gh>.22){Gh=0;let m=$e.bulbs,g=Math.floor(e*4);for(let f=0;f<m.n;f++){let y=m.BC[f%m.BC.length],x=(f+g)%7!==0?1:.25;m.mesh.setColorAt(f,fx.setRGB(y[0]*x,y[1]*x,y[2]*x))}m.mesh.instanceColor.needsUpdate=!0}t?(dx(i),lx(i)):Ki.update(e,i),Ji>.95&&o>.9&&(Ki.shake=Math.max(Ki.shake,.2)),_f.uniforms.uTime.value=e}function pc(i){if(fs){if(Oi.render(),mf<3&&Oi.renderTarget1.samples&&++mf===3){let e=si.getContext(),t=new Uint8Array(4);if(e.readPixels(Math.floor(e.drawingBufferWidth/2),Math.floor(e.drawingBufferHeight/2),1,1,e.RGBA,e.UNSIGNED_BYTE,t),t[0]+t[1]+t[2]===0){Zf=!0;for(let n of[Oi.renderTarget1,Oi.renderTarget2])n.samples=0,n.dispose();Oi.render()}}Kv(i)&&(si.autoClear=!1,si.render(Mf,X1),si.autoClear=!0)}}function xa(){pn||Object.assign(wr,{w:Hi.clientWidth||innerWidth,h:Hi.clientHeight||innerHeight,dpr:devicePixelRatio||1});let i=wr.w,e=wr.h,t=hu()?yo[Qe.nivel].escala:Math.min(wr.dpr,j.open?1.75:1.25);i<2||e<2||(fs=i,fo=e,si.setPixelRatio(t),si.setSize(i,e,!1),Oi.setPixelRatio(t),Oi.setSize(i,e),Lt.aspect=i/e,Lt.updateProjectionMatrix(),ix(i,e),gs.width=Math.round(i*t),gs.height=Math.round(e*t),tu="")}function mo(){let i=hu(),e=yo[Qe.nivel];su.enabled=!i||e.bloom,Hn.ponCuantos(i?e.publico:Hn.n),si.shadowMap.autoUpdate=!i,si.shadowMap.needsUpdate=!0;let t=i||Zf?0:4;for(let n of[Oi.renderTarget1,Oi.renderTarget2])n.samples!==t&&(n.samples=t,n.dispose());xa()}function Jf(i){if(!(i>.25)){if(Qe.ema+=(i-Qe.ema)*.05,Qe.prueba){Qe.prueba-=i,Qe.prueba<=0&&(Qe.prueba=0,Qe.ema<1/45?Qe.alDemasiado?.():Qe.inocente=!0);return}Qe.ema>1/48?(Qe.malo+=i,Qe.bueno=0):Qe.ema<1/57?(Qe.bueno+=i,Qe.malo=0):Qe.malo=Qe.bueno=0,Qe.malo>1.5&&(Qe.malo=0,Qe.nivel<yo.length-1?(Qe.nivel++,mo()):Qe.ema>1/36&&!Qe.inocente&&++Qe.peor>=3&&(Qe.peor=0,Qe.prueba=3,Qe.ema=1/40)),Qe.bueno>12&&Qe.nivel>Qe.min&&(Qe.bueno=0,Qe.nivel--,mo())}}function $f(){if(Pr=0,!ga)return;Pr=Kf($f);let i=performance.now()/1e3,e=i-ru;if(ru=i,pn?wr.oculto:document.hidden)return;if(hu()){if(Qe.externo||Jf(e),Qe.prueba)return;let n=yo[Qe.nivel],r=1/n.fps;if(Qe.acum+=e,Qe.acum<r*.9)return;let a=Math.min(.1,Qe.acum);Qe.acum=Math.min(r,Qe.acum-r),Qe.acum<0&&(Qe.acum=0),Zt.run||(a=0),++Qe.cuadros%n.sombra===0&&(si.shadowMap.needsUpdate=!0),dc(a),pc(a);return}let t=Math.min(.05,e);Zt.run||(t=0),dc(t),pc(t)}var pn,Vh,Mt,go,wr,Se,Ue,On,Oe,U1,ct,Ve,Gn,Fp,P,ic,Gp,ei,Ii,Ne,k1,vi,wh,Yt,N1,B1,xf,Vp,ql,Ah,pa,Wh,ai,nc,yf,bf,z1,H1,ho,G1,au,Wp,V1,Hi,si,Ge,Lt,W1,Oi,su,_f,gs,j1,ou,Mf,X1,fc,vs,Rh,Ch,Ph,mc,q1,jh,Y1,Lh,Ih,Xh,Pe,Ar,xs,cu,lt,qp,Tf,We,po,$e,Wt,ua,Yl,Zp,Jp,Bt,tv,Er,un,Bn,Mr,oo,oa,la,ca,ha,iv,Zl,Kp,nv,Sr,$p,Qp,Uh,kh,Nh,Jl,Kl,rv,av,ef,sv,ov,cv,hv,uv,nf,Af,dv,Rf,pv,Cf,fv,qh,mv,fa,gv,vv,Bh,rc,ac,Oh,rf,$l,Cr,Rn,vo,Di,xv,Hh,ar,_v,Mv,Sv,Tv,Ev,Df,Rv,Cv,of,Ri,Lr,Uf,Iv,Dv,kf,Uv,kv,Nv,Nf,Bv,Ov,Mi,zn,Ui,ds,Tr,sc,Ai,kt,Vn,zv,Bf,lf,Hv,Yh,ys,cf,Zh,Jh,Kh,$h,Qh,eu,Hf,Zt,Hn,Ni,Ff,ms,ma,da,Qi,Wn,jn,us,zt,Bi,Fn,Rr,St,Fh,uf,Xv,xi,qv,_t,ec,tc,Yv,df,Zv,Jv,Ki,$i,lo,tu,fs,fo,j,oc,Qv,ex,uc,pf,iu,gc,tx,ff,Ct,Xf,Li,gi,mi,cx,ru,Ji,co,Gh,mf,Zf,gf,vf,fx,yo,Qe,hu,ga,Pr,bs,Kf,mx,gx,Qf,tm=ki(async()=>{kn();Ap();Rp();Lp();xh();Up();Np();Hp();pn=typeof document>"u",Vh=new Proxy(function(){},{get:(i,e)=>e===Symbol.toPrimitive?()=>"":e==="then"?void 0:Vh,set:()=>!0,apply:()=>Vh}),Mt=i=>pn?Vh:document.querySelector(i),go=(i=1,e=1)=>{let t=pn?new OffscreenCanvas(i,e):document.createElement("canvas");return t.width=i,t.height=e,t},wr={w:0,h:0,dpr:1,oculto:!1},Se=(i,e,t)=>Math.max(e,Math.min(t,i)),Ue=(i,e,t)=>i+(e-i)*t,On=(i,e,t,n)=>Ue(i,e,1-Math.exp(-t*n)),Oe=i=>i*i*(3-2*i),U1=i=>i<.5?4*i*i*i:1-Math.pow(-2*i+2,3)/2;ct=xo(Date.now()&65535),Ve=(i,e)=>i+(e-i)*ct(),Gn=i=>i[Math.floor(ct()*i.length)],Fp=i=>{let e=0;for(let n in i)e+=Math.max(0,i[n]);let t=ct()*e;for(let n in i)if(t-=Math.max(0,i[n]),t<=0)return n;return Object.keys(i)[0]},P=(i=0,e=0,t=0)=>new D(i,e,t),ic=P(0,1,0),Gp=i=>new Promise(e=>setTimeout(e,i)),ei=(i,e)=>new ke(i).multiplyScalar(e).getHex(),Ii=(i,e,t)=>Math.exp(-((i-e)*(i-e))/(2*t*t)),Ne=1.8,k1=140,vi=60/k1,wh=vi/4,Yt=vi*4,N1={m:{sw:.28,chest:.232,waist:.145,hip:.165,arm:1,bust:0,height:1,neck:.012,shX:.95,shY:0},f:{sw:.215,chest:.19,waist:.122,hip:.168,arm:1,bust:1,height:.96,neck:-.008,shX:.86,shY:.03}},B1={m:{eyeSize:1,eyeGap:1,nose:1,noseW:1,lips:.8,mouthW:1,jaw:1,chin:1,cheek:.7,browThick:1,browArch:.25,browRidge:1},f:{eyeSize:1.12,eyeGap:1,nose:.95,noseW:1,lips:1.3,mouthW:.92,jaw:.25,chin:.55,cheek:1,browThick:.85,browArch:.7,browRidge:.35}},xf={singer:{name:"Max",ui:"#ffd23a",body:"m",skin:15317391,face:{eyes:2771578,brow:10123834,jaw:1.05},hair:{style:"long",color:15255658,color2:16180128},beard:{type:"goatee",color:13148240},top:{type:"tee",color:1381653},bottom:{type:"jeans",color:3030371},belt:2236962,shoes:{type:"boot",color:1381653},acc:{gloves:1118481,wrist:2236962},build:{sw:.275,chest:.225,waist:.14,hip:.16}},drummer:{name:"Bruno",ui:"#ffffff",body:"m",skin:14855556,face:{eyes:3811864,brow:3810322,nose:1.15,jaw:1.2},hair:{style:"short",color:8014370},beard:{type:"full",color:6962714},top:{type:"tee",color:15658734},bottom:{type:"shorts",color:7035454},legwear:{type:"socks",color:16777215},shoes:{type:"sneaker",color:14165547},acc:{sweatband:!0},build:{sw:.29,chest:.24,waist:.16,hip:.17,arm:1.05}}};if(!pn){if(!document.querySelector("link[data-rock-fuentes]")){let i=document.createElement("link");i.rel="stylesheet",i.dataset.rockFuentes="",i.href="https://fonts.googleapis.com/css2?family=Bangers&family=Rubik:wght@500;700;900&display=swap",document.head.append(i)}Vp=`#editor{position:fixed;top:0;right:0;bottom:0;width:min(400px,100vw);background:rgba(12,8,22,.93);border-left:3px solid #000;display:flex;flex-direction:column;z-index:40;font-size:13px;transition:transform .3s;font-family:Rubik,system-ui,sans-serif;color:#fff;box-sizing:border-box}
#editor.off{transform:translateX(105%);pointer-events:none}
#editor .ttl{font-family:Bangers,Impact,sans-serif;font-size:26px;letter-spacing:1px;color:#ffd23a;text-shadow:2px 2px 0 #000;padding:12px 14px 6px}
#edName{display:block;width:calc(100% - 28px);margin:0 14px;background:#221838;border:2px solid #000;border-radius:9px;color:#fff;font:inherit;font-weight:900;font-size:15px;padding:7px 9px}
#edTabs{display:flex;flex-wrap:wrap;gap:4px;padding:10px 14px 6px}
#edPane{flex:1;overflow:auto;padding:2px 14px 14px;scrollbar-width:thin}
#editor button,#edViews button{border:2px solid #000;border-radius:9px;padding:6px 8px;font:inherit;font-weight:900;background:#2b2140;color:#fff;cursor:pointer;box-shadow:0 3px 0 #000}
#editor button:active,#edViews button:active{transform:translateY(2px);box-shadow:0 1px 0 #000}
#editor button:disabled{opacity:.4;cursor:default}
#edTabs button{flex:1 1 auto;padding:6px 7px;font-size:12px}
#edTabs button.on,#edViews button.on,#editor .chip.on{background:#ffd23a;color:#1a1020}
#editor .eg{margin:12px 0 4px}
#editor .eg>b{display:block;color:#c9b8ec;font-size:11px;letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px}
#editor .chips{display:flex;flex-wrap:wrap;gap:5px}
#editor .chip{border-radius:999px;padding:5px 11px;font-weight:700;box-shadow:0 2px 0 #000}
#editor .sws{display:flex;flex-wrap:wrap;gap:6px}
#editor .sw{width:26px;height:26px;padding:0;border-radius:50%;box-shadow:0 2px 0 #000}
#editor .sw.on{outline:3px solid #ffd23a;outline-offset:2px}
#editor .sw.pick{position:relative;overflow:hidden;display:inline-block;border:2px solid #000;background:conic-gradient(#f33,#fd3,#3f6,#3df,#46f,#e4f,#f33);cursor:pointer}
#editor .sw.pick input{position:absolute;inset:-6px;opacity:0;cursor:pointer}
#editor .ehint{color:#a99bc8;font-size:11.5px;line-height:1.4;margin:6px 0}
#editor .tatl{display:flex;align-items:center;gap:8px;background:#221838;border:2px solid #000;border-radius:9px;padding:5px 8px;margin:5px 0;font-weight:700}
#editor .tatl i{width:16px;height:16px;border-radius:50%;border:2px solid #000;flex:none}
#editor .tatl span{flex:1}
#editor .chip.leg{background:linear-gradient(100deg,#3a1660,#8a2a9a,#d0641a,#3a1660);background-size:300% 100%;animation:legS 3s linear infinite;color:#ffe9a8;text-shadow:0 0 6px #ff9a3a}
#editor .chip.leg::before{content:'\u2605 ';color:#ffd23a}
#editor .chip.leg.on{background:linear-gradient(100deg,#ffd23a,#fff4b0,#ff9a2a,#ffd23a);background-size:300% 100%;color:#1a1020;text-shadow:none}
#editor .chip.leg.on::before{color:#b0401a}
@keyframes legS{to{background-position:-300% 0}}
@media (prefers-reduced-motion:reduce){#editor .chip.leg{animation:none}}
#editor .add{width:100%;margin-top:12px;background:linear-gradient(#ff5a3a,#d4231a)}
#edFoot{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 14px 14px;border-top:2px solid #000}
#edFoot .hot{background:linear-gradient(#ff5a3a,#d4231a)}
#edFoot .wide{grid-column:1/3}
#edViews{position:fixed;left:14px;bottom:14px;display:flex;flex-wrap:wrap;gap:6px;z-index:7;font-size:13px}
#edViews.off{display:none}
#edToast{position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#ffd23a;color:#1a1020;border:3px solid #000;border-radius:12px;padding:8px 16px;font-weight:900;z-index:9;opacity:0;transition:opacity .3s;pointer-events:none}
#edToast.on{opacity:1}
#editor .chip.lock{opacity:.6;background:#1a1428;color:#9a8cb8;box-shadow:0 2px 0 #000}
#editor .chip.lock::after{content:' \u{1F512}';font-size:10px}
#editor .chip.leg.lock{animation:none;background:#2a1838;color:#c9a86a;text-shadow:none}
#editor .coins{margin:12px 0 4px;background:linear-gradient(#3a2a10,#22180a);border:2px solid #000;border-radius:12px;padding:9px 12px;font-size:17px;font-weight:900;color:#ffd23a;box-shadow:0 3px 0 #000}
#editor .boxc{display:flex;gap:12px;align-items:center;margin:12px 0 0;background:#221838;border:2px solid #000;border-radius:12px;padding:10px 12px}
#editor .boxi{font-size:40px;line-height:1}
#editor .boxc b{display:block;font-size:15px;color:#fff;margin-bottom:2px}
#editor .boxc span{color:#a99bc8;font-size:12px;line-height:1.4}
#editor .colr{display:grid;grid-template-columns:1fr 70px 70px;align-items:center;gap:8px;margin:6px 0;font-weight:700}
#editor .colr i{height:8px;background:#221838;border:2px solid #000;border-radius:99px;overflow:hidden}
#editor .colr u{display:block;height:100%;background:linear-gradient(90deg,#ff9a2a,#ffd23a)}
#editor .colr em{font-style:normal;color:#c9b8ec;font-size:12px;text-align:right}
#editor.busy #edPane,#editor.busy #edFoot,#editor.busy #edTabs{pointer-events:none;opacity:.5}
.coin{display:inline-block;width:1em;height:1em;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6b0,#ffc21a 50%,#b8700c);border:2px solid #000;vertical-align:-.18em;box-sizing:border-box}
.dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #000;margin-right:5px;vertical-align:-2px}
#boxUI{position:fixed;left:calc((100vw - min(400px,100vw)) / 2);bottom:60px;transform:translate(-50%,24px);opacity:0;pointer-events:none;transition:opacity .35s,transform .35s;z-index:8;background:rgba(12,8,22,.94);border:3px solid #000;border-radius:16px;padding:12px 16px 14px;text-align:center;min-width:270px;box-shadow:0 5px 0 #000;font-size:13px;color:#fff}
#boxUI.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
#boxUI.leg{border-color:#ffd23a;box-shadow:0 0 0 3px #000,0 0 26px #ffb02a}
#boxUI .rar{font-family:Bangers,Impact,sans-serif;font-size:24px;letter-spacing:1px;text-shadow:2px 2px 0 #000}
#boxUI .nm{font-size:19px;font-weight:900;margin:2px 0 4px}
#boxUI .sub{color:#c9b8ec;margin-bottom:11px}
#boxUI .bt{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
#boxUI button{border:2px solid #000;border-radius:9px;padding:7px 10px;font:inherit;font-weight:900;background:#2b2140;color:#fff;cursor:pointer;box-shadow:0 3px 0 #000}
#boxUI button:active{transform:translateY(2px);box-shadow:0 1px 0 #000}
#boxUI button:disabled{opacity:.4;cursor:default}
#boxUI button.hot{background:linear-gradient(#ff5a3a,#d4231a)}
@media (max-width:700px){#boxUI{left:50%;bottom:calc(56vh + 54px)}}
@media (max-width:700px){#editor{top:auto;height:56vh;width:100vw;border-left:0;border-top:3px solid #000}#edViews{left:8px;bottom:calc(56vh + 8px)}#editor .ttl{display:none}}

.rock-capa,.rock-capa *{box-sizing:border-box}
.rock-capa{font-family:Rubik,system-ui,sans-serif;color:#fff}
#edViews{z-index:39}#edToast{z-index:42}#boxUI{z-index:41}
canvas.rock-lienzo{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
#editor .sws .sw.venta{opacity:.45;position:relative}
#editor .sws .sw.venta::after{content:'\u{1F3EA}';position:absolute;right:-6px;bottom:-6px;font-size:12px}
#editor .sell{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0;background:#221838;border:2px solid #000;border-radius:10px;padding:6px 8px;font-weight:700;font-size:12px}
#editor .sell span{flex:1 1 100%}
#editor .sell input{width:96px;background:#120c20;color:#fff;border:2px solid #000;border-radius:8px;padding:4px 6px;font:inherit}
#editor input:focus{outline:2px solid #ffd23a}`,document.head.append(Object.assign(document.createElement("style"),{textContent:Vp})),ql=document.createElement("div"),ql.className="rock-capa",ql.innerHTML=`<div id="editor" class="off">
  <div class="ttl">TU ROCKERO</div>
  <input id="edName" maxlength="24" placeholder="Nombre del rockero" aria-label="Nombre" translate="no">
  <div id="edTabs"></div>
  <div id="edPane"></div>
  <div id="edFoot">
    <button id="edRand">\u{1F3B2} Aleatorio</button><button id="edSave" class="hot">\u{1F4BE} Guardar</button>
    <button id="edClose" class="wide">\u2715 Cerrar</button>
  </div>
</div>
<div id="edViews" class="off"></div>
<div id="edToast"></div>
<div id="boxUI" role="dialog" aria-live="polite"></div>`,document.body.append(ql)}Ah=i=>String(i).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),pa=zp,Wh=i=>{let e=Object.values(i).map(Ri);return e.length<2?e[0]:`conic-gradient(${e.map((t,n)=>`${t} ${n/e.length*100}% ${(n+1)/e.length*100}%`).join(",")})`},ai={coins:0,parada:!1,own:Xl().map(i=>({...i})),opened:0,last:[]},nc=(i,e,t)=>t==="none"||ai.own.some(n=>n.b===i&&n.k===e&&n.t===t&&!n.venta),yf=(i,e,t)=>ai.own.filter(n=>n.b===i&&n.k===e&&n.t===t&&!n.venta),bf=(i,e,t)=>ai.own.filter(n=>n.b===i&&n.k===e&&n.t===t);z1={faceShape:{ovalF:{faceW:.93},corazonF:{faceW:.95,jaw:.06,chin:.38,cheek:1.35},redondaF:{faceW:1,jaw:.58,chin:.45,cheek:1.25,faceLong:.965},fina:{faceW:.87,jaw:.18,chin:.72,faceLong:1.035},suave:{faceW:.97,jaw:.78,chin:.62,cheek:.85},cuadrada:{jaw:1.25,chin:1.1,faceW:1.02},ovalM:{jaw:.7,chin:.9,faceW:.96},alargada:{jaw:.95,chin:1.15,faceW:.91,faceLong:1.045},redondaM:{jaw:.52,chin:.85,faceW:1.05,cheek:1.05,faceLong:.965},angulosa:{jaw:1.15,chin:1.3,cheek:1.35,faceW:.95,browRidge:1.6}},eyeShape:{grandes:{},almendra:{eyeSize:1.06,eyeOpen:.82,lowLid:.78,tilt:1.5,irisK:.96},gata:{eyeSize:1.1,eyeOpen:.74,lowLid:.7,tilt:3,liner:1.6,irisK:.92},redondos:{eyeSize:1.08,eyeOpen:1.16,lowLid:1.25,tilt:-.6,irisK:.9},normales:{},rasgados:{eyeOpen:.7,lowLid:.72,tilt:1.3},intensos:{eyeOpen:.8,tilt:-.6,irisK:.86,browDrop:.004},abiertos:{eyeSize:1.12,eyeOpen:1.1,lowLid:1.1},cansados:{eyeOpen:.64,tilt:-1.4,lowLid:.9}},browStyle:{arqueadas:{browThick:.85,browArch:.95},finas:{browThick:.52,browArch:.75,browLen:.95},rectasF:{browThick:.8,browArch:.08,browStraight:.5},corte:{browThick:.85,browArch:.7,browSlit:1},gruesas:{browThick:1.3,browArch:.25,browStraight:.4},rectasM:{browThick:1.05,browArch:0,browStraight:.85},pobladas:{browThick:1.5,browArch:.3,browBushy:1,browStraight:.5},cicatriz:{browThick:1.15,browArch:.25,browSlit:1,scar:1}},mkStyle:{ningunoF:{makeup:0,liner:.4},natural:{makeup:.6},ahumado:{makeup:1.3},gotico:{makeup:1.4,mkGoth:1,liner:1.3},glam:{makeup:1.2,glitter:1,liner:1.5,lashLen:1.5},estrellaMk:{makeup:.4,star:1},cristales:{makeup:.7,legMk:3,liner:1.4},aurora:{makeup:0,legMk:4,liner:1.3,lashLen:1.3},grietas:{legMk:5,makeup:0},mariposaMk:{makeup:.3,legMk:6,liner:1.4,lashLen:1.4},ninguno:{},delineado:{guyliner:1,lineW:.78},corpse:{corpse:1,lineW:.78},guerra:{warpaint:1},ojeras:{bags:1},calaNeon:{lineW:.78,legMk:1,makeup:0},runas:{legMk:2,makeup:0}}},H1={clasico:0,brillo:1,corazon:2,estrella:3,degradado:4,felino:5,anillo:6,hetero:7,fantasma:8,rayo:9,eclipse:10,galaxia:11,latido:12,vortice:13,prisma:14};ho={shock:{name:"\xA1DESCARGA!",color:"#6fd8ff",bolt:[1.4,2.6,6]},fire:{name:"\xA1LLAMARADA!",color:"#ff8a2a",bolt:[6,2.2,.5]},broken:{name:"\xA1CUERDA ROTA!",color:"#ffd23a",bolt:[5,4.2,.8]},lefty:{name:"\xA1GIRO ZURDO!",color:"#9dff4a",bolt:[1.4,5,1]},amp:{name:"\xA1AMP FRITO!",color:"#e08cff",bolt:[4,1.4,6]}},G1=[["intro",5],["verse",8],["pre",4],["chorus",8],["verse",8],["chorus",8],["solo",8],["break",4],["chorus",8],["outro",2]],au={intro:.55,verse:.62,pre:.78,chorus:1,solo:1,break:.88,outro:1},Wp=[9,16,20,24,30,36,41,45,50,55,59],V1=61,Hi=pn?globalThis.ROCK_LIENZO:document.createElement("canvas");pn||(Hi.className="rock-lienzo");si=new Gs({canvas:Hi,antialias:!0,powerPreference:"high-performance"});si.setPixelRatio(1);si.setSize(2,2,!1);si.shadowMap.enabled=!0;si.shadowMap.type=rh;si.toneMapping=no;si.toneMappingExposure=1;Ge=new Vs;Ge.fog=new Ml(727840,38,130);Lt=new bi(45,16/9,.05,500);Lt.position.set(0,6,16);W1=new _i(16,16,{type:qi,samples:4}),Oi=new Fl(si,W1);Oi.addPass(new Gl(Ge,Lt));Oi.addPass(new na({uniforms:{tDiffuse:{value:null}},vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",fragmentShader:"uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); bvec4 bad = bvec4(c.r != c.r, c.g != c.g, c.b != c.b, c.a != c.a); gl_FragColor = any(bad) ? vec4(0.0, 0.0, 0.0, 1.0) : clamp(c, 0.0, 64.0); }"}));su=new hs(new Re(256,256),.42,.5,1.1);Oi.addPass(su);_f=new na({uniforms:{tDiffuse:{value:null},uTime:{value:0},uVig:{value:.42},uSat:{value:1.14},uCon:{value:1.07},uGrain:{value:.02}},vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",fragmentShader:`uniform sampler2D tDiffuse; uniform float uTime,uVig,uSat,uCon,uGrain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec4 c=texture2D(tDiffuse,vUv); vec3 col=c.rgb;
      float l=dot(col,vec3(0.2126,0.7152,0.0722)); col=mix(vec3(l),col,uSat); col=max((col-0.18)*uCon+0.18,0.0);
      vec2 d=vUv-0.5; col*=1.0-uVig*dot(d,d)*2.4;
      col+=(h(vUv*913.0+fract(uTime)*37.0)-0.5)*uGrain*(0.25+l);
      gl_FragColor=vec4(col,c.a); }`});Oi.addPass(_f);Oi.addPass(new Vl);gs=go(),j1=gs.getContext("2d"),ou=new Jr(gs);ou.colorSpace=$t;Mf=new Vs,X1=new gr(-1,1,1,-1,0,1);Mf.add(new yt(new pi(2,2),new Pt({map:ou,transparent:!0,depthTest:!1,toneMapped:!1})));fc=(()=>{let i=new Uint8Array([62,128,196,255]),e=new qr(i,4,1,hh);return e.minFilter=e.magFilter=hi,e.generateMipmaps=!1,e.needsUpdate=!0,e})(),vs=(()=>{let i=new Uint8Array([145,182,218,242]),e=new qr(i,4,1,hh);return e.minFilter=e.magFilter=hi,e.generateMipmaps=!1,e.needsUpdate=!0,e})(),Rh=new Map;Ch=new Map;Ph=new Map;mc={value:0},q1={lava:0,galaxy:1,holo:2,glitter:3,neon:4,electric:5,chrome:6,fire:7,crystal:8},jh=`
float lh1(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float lnz(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lh1(i), lh1(i + vec3(1.0, 0.0, 0.0)), f.x), mix(lh1(i + vec3(0.0, 1.0, 0.0)), lh1(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(lh1(i + vec3(0.0, 0.0, 1.0)), lh1(i + vec3(1.0, 0.0, 1.0)), f.x), mix(lh1(i + vec3(0.0, 1.0, 1.0)), lh1(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float lfbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * lnz(p); p = p * 2.03 + 0.17; a *= 0.5; } return s; }
float lcell(vec3 p) {   // distancia al borde entre celdas: grietas y facetas
  vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)), o = vec3(lh1(i + g), lh1(i + g + 17.3), lh1(i + g + 41.7));
    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1; }
vec3 lhue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float lspark(vec3 p) {   // destellos: algunas celdas tienen una chispa que parpadea
  vec3 i = floor(p), f = fract(p) - 0.5; float r = lh1(i), tw = pow(max(0.0, sin(uLT * (1.5 + r * 4.0) + r * 60.0)), 16.0);
  vec3 o = (vec3(lh1(i + 3.1), lh1(i + 5.7), lh1(i + 9.3)) - 0.5) * 0.5;
  return tw * smoothstep(0.22, 0.0, length(f - o)) * step(0.45, r); }
`,Y1=`uniform float uLT, uLS, uLK; uniform vec3 uLA, uLB; varying vec3 vLp;
`+jh+`
void legApply(inout vec3 base, inout vec3 em, vec3 n, vec3 v) {
  vec3 p = vLp * uLS; float fr = 1.0 - abs(dot(n, v));
#ifdef USE_MAP
  float ml = 0.55 + 0.65 * dot(base, vec3(0.333));
#else
  float ml = 1.0;
#endif
  vec3 b = uLA;
#if LK == 0   // lava: roca oscura con grietas incandescentes que laten
  float cr = 1.0 - smoothstep(0.0, 0.09, lcell(p + vec3(0.0, -uLT * 0.12, 0.0)));
  float pu = 0.6 + 0.4 * sin(uLT * 2.6 + lfbm(p * 0.6) * 7.0);
  b = uLA * (0.55 + 0.6 * lfbm(p * 2.5)); b = mix(b, uLB, cr * 0.6);
  em = uLB * (cr * 2.8 * pu + 0.25 * smoothstep(0.55, 0.8, lfbm(p * 0.9 + uLT * 0.2)));
#elif LK == 1   // galaxia: nebulosa que fluye + estrellas que titilan
  float nb = lfbm(p * 0.9 + vec3(uLT * 0.05, uLT * 0.03, -uLT * 0.04));
  vec3 nc = mix(uLA, uLB, smoothstep(0.3, 0.75, lfbm(p * 0.6 - uLT * 0.03)));
  b = mix(vec3(0.03, 0.015, 0.07), nc, smoothstep(0.35, 0.8, nb));
  em = nc * smoothstep(0.5, 0.85, nb) * 0.9 + vec3(1.0, 0.95, 1.0) * (lspark(p * 7.0) * 3.5 + lspark(p * 13.0 + 7.0) * 2.0) + nc * pow(fr, 3.0) * 0.6;
#elif LK == 2   // hologr\xE1fico: arco\xEDris que cambia con el \xE1ngulo + barrido de brillo
  float h = fract(dot(p, vec3(0.13, 0.21, 0.07)) + fr * 0.55 + uLT * 0.12);
  vec3 rb = lhue(h);
  b = mix(uLA, rb * 0.85 + 0.15, 0.7);
  float sw = smoothstep(0.93, 1.0, sin(dot(p, vec3(0.3, 0.5, 0.15)) * 2.0 - uLT * 2.4));
  em = rb * (0.25 + 1.6 * pow(fr, 2.0)) + vec3(1.0) * (sw * 1.6 + lspark(p * 9.0) * 2.5);
#elif LK == 3   // brillantina: chispas densas que destellan
  b = uLA * (0.85 + 0.3 * fr);
  em = (uLB * 0.6 + 0.4) * (lspark(vLp * 70.0) * 3.5 + lspark(vLp * 110.0 + 3.3) * 2.5) + uLB * pow(fr, 2.5) * 0.5 + uLA * 0.15;
#elif LK == 4   // ne\xF3n: l\xEDneas que corren
  float s = fract((vLp.y + abs(vLp.x) * 0.6) * uLS - uLT * 0.6);
  float ln = smoothstep(0.12, 0.0, abs(s - 0.5) - 0.06);
  vec3 nc = mix(uLA, uLB, 0.5 + 0.5 * sin(vLp.y * uLS * 0.5 - uLT * 1.5));
  b = mix(uLA * 0.3, nc, ln);
  em = nc * (ln * 2.6 + 0.35 + pow(fr, 2.0) * 0.8);
#elif LK == 5   // el\xE9ctrico: venas de rayo que saltan
  float j = floor(uLT * 9.0);
  float ln = 1.0 - smoothstep(0.0, 0.018, abs(lfbm(p * 1.4 + vec3(j * 0.31, j * 0.17, 0.0)) - 0.5));
  float fl = 0.6 + 0.4 * step(0.4, lh1(vec3(j)));
  b = mix(uLA * 0.55, uLB, ln * 0.5);
  em = uLB * (ln * 3.2 * fl + 0.06 + pow(fr, 3.0) * 0.5);
#elif LK == 6   // cromado / dorado: reflejo falso (cielo arriba) + barrido de brillo
  float hz = n.y + 0.14 * sin(dot(p, vec3(0.9, 0.3, 0.6)) * 1.5) - 0.05;   // horizonte reflejado: cielo claro arriba, franja oscura, suelo medio
  float band = 1.0 - smoothstep(0.0, 0.09, abs(hz + 0.12));
  float sw = 1.0 - smoothstep(0.0, 0.025, abs(fract(dot(p, vec3(0.08, 0.12, 0.04)) - uLT * 0.3) - 0.5));   // barrido fino
  b = uLA * 0.3;   // el reflejo va casi todo en el brillo propio: las luces del escenario no lo aplanan
  em = uLA * mix(0.1, 0.95, smoothstep(-0.03, 0.05, hz)) * (1.0 - 0.85 * band) + uLB * sw * 1.8 + uLA * pow(fr, 3.0) * 0.6 + vec3(1.0) * lspark(p * 6.0) * 2.0;
#elif LK == 7   // fuego: llamas que suben
  float f = lfbm(vec3(p.x, p.y - uLT * 1.1, p.z) * 1.4);
  float it = smoothstep(0.38, 0.8, f);
  b = mix(uLA * 0.45, uLB, it * 0.7);
  em = mix(uLA, uLB, it) * (it * 2.4 + 0.3) * (0.85 + 0.15 * sin(uLT * 13.0));
#elif LK == 8   // cristal: facetas con borde de luz y destellos
  float e = 1.0 - smoothstep(0.0, 0.07, lcell(p));
  b = mix(uLA * 0.75, vec3(1.0), 0.1 + 0.4 * fr) * (0.75 + 0.45 * lnz(p * 1.5));
  em = uLA * (0.12 + 0.9 * pow(fr, 2.0)) + uLB * e * (0.5 + 0.4 * sin(uLT * 2.0 + p.y)) + vec3(1.0) * lspark(p * 5.0) * 3.0;
#endif
  base = b * ml;
}
`,Lh=new Map;Ih=new Map;Xh={},Pe=(i,e)=>Xh[i]||(Xh[i]=e());Ar=class{constructor(){this.g=new Map}add(e,t,n=[0,0,0],r=[0,0,0],a=[1,1,1],s=0){let o=t.index?t.toNonIndexed():t.clone();o.clearGroups();for(let c of Object.keys(o.attributes))["position","normal","uv"].includes(c)||o.deleteAttribute(c);o.attributes.uv||o.setAttribute("uv",new He(new Float32Array(o.attributes.position.count*2),2)),o.attributes.normal||o.computeVertexNormals(),o.applyMatrix4(new Ze().compose(P(...n),new Xt().setFromEuler(new $a(...r)),P(...a)));let l=e.uuid+"|"+s;this.g.has(l)||this.g.set(l,{mat:e,outline:s,list:[]}),this.g.get(l).list.push(o)}build(e,t=!1){for(let{mat:n,outline:r,list:a}of this.g.values())he(e,ao(a),n,{outline:r,shadow:t})}};xs={ground:{boot:-.099,sneaker:-.099,platform:-.1675},sole:{boot:.026,sneaker:.03,platform:.088}},cu=i=>.052*(1+.1*Math.exp(-((i-.11)**2)/.004))*(i<0?Ue(1,.82,Se(-i/.075,0,1)):1);lt=xo(99);qp={},Tf=(i,e,t=8,n=[1,3])=>qp[i+e+t+n]||(qp[i+e+t+n]=ft(32,64,(r,a,s)=>{for(let o=0;o<t;o++)r.fillStyle=o%2?e:i,r.fillRect(0,o*s/t,a,s/t)},{repeat:n})),We={};po=P(-5.2,0,13.5),$e={cans:[],lanterns:[],cones:[],fireSprites:[],lights:{},amps:[]};Wt=i=>{let e=new ns;return i(e),e},ua=(i,e,t,n,r=Math.PI/2,a=5)=>Wt(s=>{for(let o=0;o<a*2;o++){let l=r+o*Math.PI/a,c=o%2?n:t;o?s.lineTo(i+Math.cos(l)*c,e+Math.sin(l)*c):s.moveTo(i+Math.cos(l)*c,e+Math.sin(l)*c)}s.closePath()}),Yl=i=>Wt(e=>{e.moveTo(0,-i),e.bezierCurveTo(-i*.2,-i*.6,-i*1.1,-i*.3,-i,i*.3),e.bezierCurveTo(-i*.95,i*.85,-i*.25,i*.95,0,i*.45),e.bezierCurveTo(i*.25,i*.95,i*.95,i*.85,i,i*.3),e.bezierCurveTo(i*1.1,-i*.3,i*.2,-i*.6,0,-i)}),Zp=(i,e)=>Wt(t=>{for(let n=0;n<=72;n++){let r=n/72*Math.PI*2,a=16*Math.sin(r)**3,s=13*Math.cos(r)-5*Math.cos(2*r)-2*Math.cos(3*r)-Math.cos(4*r),o=.0155*i*s+e,l=.0115*i*a;n?t.lineTo(o,l):t.moveTo(o,l)}});Jp=i=>Wt(e=>{[[.1,.5],[-.25,.02],[.02,.02],[-.12,-.5],[.28,.08],[0,.08],[.18,.5]].forEach(([t,n],r)=>r?e.lineTo(t*i,n*i):e.moveTo(t*i,n*i)),e.closePath()}),Bt={offset:{shape:()=>Wt(i=>{i.moveTo(-.25,0),i.bezierCurveTo(-.26,.13,-.16,.18,-.05,.165),i.bezierCurveTo(.05,.155,.12,.2,.22,.15),i.bezierCurveTo(.2,.09,.15,.05,.12,.04),i.lineTo(.12,-.04),i.bezierCurveTo(.16,-.06,.2,-.09,.19,-.12),i.bezierCurveTo(.1,-.19,.02,-.17,-.06,-.17),i.bezierCurveTo(-.17,-.18,-.26,-.12,-.25,0)}),guard:()=>Wt(i=>{i.moveTo(.12,.035),i.bezierCurveTo(.06,.07,-.04,.06,-.09,.045),i.bezierCurveTo(-.16,.02,-.22,-.06,-.17,-.12),i.bezierCurveTo(-.1,-.16,.02,-.15,.09,-.11),i.bezierCurveTo(.14,-.08,.13,-.05,.12,-.035),i.closePath()}),head:()=>Wt(i=>{i.moveTo(0,-.03),i.lineTo(.07,-.048),i.lineTo(.2,-.03),i.lineTo(.25,.035),i.lineTo(.18,.055),i.lineTo(.05,.048),i.lineTo(0,.03),i.closePath()}),tuners:[.05,.075,.1,.125,.15,.175].map(i=>[i,.05,1]),pickups:[["single",-.065],["single",.03]],bridge:-.13,trem:!0,knobs:[[-.13,-.1],[-.075,-.125],[-.185,-.065]],sw:[.05,.11],tailBtn:[-.26,0],hornBtn:[.21,.145],tip:[.25,.035]},vee:{shape:()=>Wt(i=>{i.moveTo(.15,.045),i.lineTo(-.34,.215),i.quadraticCurveTo(-.43,.245,-.44,.17),i.lineTo(-.17,.035),i.quadraticCurveTo(-.15,0,-.17,-.035),i.lineTo(-.44,-.17),i.quadraticCurveTo(-.43,-.245,-.34,-.215),i.lineTo(.15,-.045),i.quadraticCurveTo(.17,0,.15,.045)}),guard:()=>Wt(i=>{i.moveTo(.14,.04),i.lineTo(-.05,.085),i.lineTo(-.15,.06),i.lineTo(-.15,-.06),i.lineTo(-.05,-.085),i.lineTo(.14,-.04),i.closePath()}),head:()=>Wt(i=>{i.moveTo(0,-.03),i.lineTo(.17,-.065),i.lineTo(.22,0),i.lineTo(.17,.065),i.lineTo(0,.03),i.closePath()}),tuners:[[.05,-.04,-1],[.095,-.05,-1],[.14,-.06,-1],[.05,.04,1],[.095,.05,1],[.14,.06,1]],pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.135,knobs:[[-.2,-.115],[-.27,-.14],[-.235,-.17]],sw:[-.2,.13],tailBtn:[-.42,-.2],hornBtn:[.13,.055],tip:[.22,0]},sg:{shape:()=>Wt(i=>{i.moveTo(.1,.045),i.bezierCurveTo(.14,.06,.2,.1,.215,.16),i.bezierCurveTo(.16,.15,.1,.13,.05,.14),i.bezierCurveTo(-.05,.17,-.2,.18,-.25,.1),i.bezierCurveTo(-.29,.05,-.29,-.05,-.25,-.1),i.bezierCurveTo(-.2,-.18,-.05,-.17,.04,-.14),i.bezierCurveTo(.09,-.13,.14,-.14,.185,-.155),i.bezierCurveTo(.16,-.1,.13,-.06,.1,-.045),i.closePath()}),guard:()=>Wt(i=>{i.moveTo(.1,-.04),i.lineTo(0,-.045),i.bezierCurveTo(-.08,-.06,-.12,-.1,-.17,-.13),i.bezierCurveTo(-.1,-.15,0,-.14,.06,-.12),i.bezierCurveTo(.1,-.1,.11,-.06,.1,-.04),i.closePath()}),head:()=>Wt(i=>{i.moveTo(0,-.03),i.lineTo(.17,-.05),i.quadraticCurveTo(.205,-.052,.2,-.02),i.quadraticCurveTo(.185,0,.2,.02),i.quadraticCurveTo(.205,.052,.17,.05),i.lineTo(0,.03),i.closePath()}),tuners:[[.06,-.04,-1],[.105,-.045,-1],[.15,-.05,-1],[.06,.04,1],[.105,.045,1],[.15,.05,1]],pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.145,knobs:[[-.15,-.085],[-.205,-.055],[-.135,-.13],[-.195,-.105]],sw:[.13,.1],tailBtn:[-.28,0],hornBtn:[.21,.155],tip:[.2,0]}};Bt.explorer={shape:()=>Wt(i=>{i.moveTo(.12,.045),i.lineTo(.27,.13),i.quadraticCurveTo(.275,.16,.245,.165),i.lineTo(-.02,.13),i.lineTo(-.2,.155),i.quadraticCurveTo(-.37,.16,-.38,.03),i.lineTo(-.3,-.125),i.quadraticCurveTo(-.27,-.15,-.2,-.14),i.lineTo(-.08,-.13),i.lineTo(.06,-.068),i.lineTo(.12,-.045),i.closePath()}),guard:()=>Wt(i=>{i.moveTo(.11,.04),i.lineTo(.2,.1),i.lineTo(0,.1),i.lineTo(-.16,.12),i.lineTo(-.13,.03),i.lineTo(-.05,-.05),i.lineTo(.05,-.055),i.lineTo(.11,-.04),i.closePath()}),head:()=>Wt(i=>{i.moveTo(0,-.03),i.lineTo(.2,-.062),i.quadraticCurveTo(.245,-.07,.25,-.035),i.lineTo(.2,.045),i.lineTo(0,.03),i.closePath()}),tuners:[.045,.075,.105,.135,.165,.195].map(i=>[i,.035+i*.05,1]),pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.145,knobs:[[-.17,-.085],[-.22,-.06],[-.27,-.035]],sw:[.09,.105],tailBtn:[-.375,.03],hornBtn:[.25,.15],tip:[.25,-.035]};Bt.heart={shape:()=>Zp(1,.035),guard:()=>Zp(.62,.062),head:Bt.offset.head,tuners:Bt.offset.tuners,pickups:[["hum",-.03],["hum",.055]],bridge:-.09,tail:-.125,knobs:[[-.09,-.06],[-.05,-.095],[0,-.125]],sw:[.07,.125],tailBtn:[-.225,0],hornBtn:[.19,.12],tip:[.25,.035]};Bt.star={shape:()=>ua(-.03,0,.255,.13,Math.PI),guard:()=>ua(-.03,0,.12,.07,Math.PI),head:Bt.vee.head,tuners:Bt.vee.tuners,pickups:[["hum",-.04],["hum",.045]],bridge:-.095,tail:-.13,knobs:[[-.07,-.13],[-.085,-.17]],sw:[-.075,.15],tailBtn:[-.28,0],hornBtn:[.16,.135],tip:[.22,0]};Bt.hacha={shape:()=>Wt(i=>{i.moveTo(.13,.04),i.lineTo(0,.055),i.lineTo(.08,.2),i.quadraticCurveTo(-.12,.33,-.32,.2),i.lineTo(-.2,.06),i.quadraticCurveTo(-.24,0,-.2,-.06),i.lineTo(-.32,-.2),i.quadraticCurveTo(-.12,-.33,.08,-.2),i.lineTo(0,-.055),i.lineTo(.13,-.04),i.closePath()}),guard:null,head:Bt.explorer.head,tuners:Bt.explorer.tuners,pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.135,knobs:[[-.16,-.15],[-.1,-.17],[-.22,-.14]],sw:[-.1,.2],tailBtn:[-.22,0],hornBtn:[.07,.19],tip:[.25,-.035],leg:["lava",16734736,7]};Bt.rayoG={shape:()=>Wt(i=>{[[.14,.045],[.05,.08],[.2,.19],[-.06,.12],[-.02,.15],[-.3,.17],[-.2,.06],[-.26,0],[-.16,-.06],[-.36,-.2],[-.04,-.11],[-.08,-.15],[.12,-.12],[.05,-.08],[.14,-.045]].forEach(([e,t],n)=>n?i.lineTo(e,t):i.moveTo(e,t)),i.closePath()}),guard:null,head:Bt.vee.head,tuners:Bt.vee.tuners,pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.135,knobs:[[-.13,.1],[-.19,.125],[-.1,.13]],sw:[.06,-.1],tailBtn:[-.26,0],hornBtn:[.18,.18],tip:[.22,0],leg:["electric",7002367,7]};Bt.mariposa={shape:()=>Wt(i=>{i.moveTo(.13,.04),i.bezierCurveTo(.17,.15,.1,.28,-.02,.265),i.bezierCurveTo(-.12,.25,-.15,.14,-.1,.075),i.bezierCurveTo(-.2,.17,-.34,.15,-.33,.07),i.bezierCurveTo(-.32,.03,-.27,.015,-.255,0),i.bezierCurveTo(-.27,-.015,-.32,-.03,-.33,-.07),i.bezierCurveTo(-.34,-.15,-.2,-.17,-.1,-.075),i.bezierCurveTo(-.15,-.14,-.12,-.25,-.02,-.265),i.bezierCurveTo(.1,-.28,.17,-.15,.13,-.04),i.closePath()}),guard:null,head:Bt.offset.head,tuners:Bt.offset.tuners,pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.135,knobs:[[-.24,-.08],[-.27,-.1],[-.21,-.11]],sw:[.02,.17],tailBtn:[-.255,0],hornBtn:[0,.25],tip:[.25,.035],leg:["holo",16777215,6]};Bt.luna={shape:()=>Ef(-.08,0,.22,-.32,.06,.17),guard:null,head:Bt.vee.head,tuners:Bt.vee.tuners,pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.135,knobs:[[-.1,-.15],[-.04,-.17],[-.15,-.12]],sw:[-.02,.17],tailBtn:[-.25,-.09],hornBtn:[-.19,.17],tip:[.22,0],leg:["galaxy",2808063,7]};Bt.llamaG={shape:()=>Wt(i=>{let e=[[.06,.075],[.11,.19],[0,.12],[-.04,.24],[-.11,.13],[-.2,.22],[-.21,.1],[-.3,.12],[-.28,.03],[-.33,-.03],[-.28,-.09],[-.33,-.19],[-.2,-.13],[-.17,-.24],[-.08,-.14],[.02,-.2],[.05,-.08],[.13,-.04]];i.moveTo(.13,.04),i.splineThru(e.map(([t,n])=>new Re(t,n))),i.closePath()}),guard:null,head:Bt.explorer.head,tuners:Bt.explorer.tuners,pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.135,knobs:[[-.2,-.1],[-.15,-.115],[-.24,-.06]],sw:[-.07,.1],tailBtn:[-.3,0],hornBtn:[-.04,.2],tip:[.25,-.035],leg:["fire",16764992,7]};Bt.gema={shape:()=>Wt(i=>{[[.13,.04],[.05,.16],[-.12,.22],[-.3,.1],[-.35,0],[-.3,-.1],[-.12,-.22],[.05,-.16],[.13,-.04]].forEach(([e,t],n)=>n?i.lineTo(e,t):i.moveTo(e,t)),i.closePath()}),guard:null,head:Bt.vee.head,tuners:Bt.vee.tuners,pickups:[["hum",-.045],["hum",.055]],bridge:-.1,tail:-.135,knobs:[[-.2,-.12],[-.25,-.07],[-.15,-.15]],sw:[-.06,.13],tailBtn:[-.35,0],hornBtn:[-.12,.2],tip:[.22,0],leg:["crystal",16777215,6]};tv={hacha:[16734736,16764992],rayoG:[4897023,16777215],mariposa:[16739032,10152191],luna:[9067263,2808063],llamaG:[16738832,16764992],gema:[7002367,16777215]},Er=i=>.9-.9*(1-Math.pow(2,-i/12));un=P(),Bn=P(),Mr=P(),oo=P(),oa=P(),la=P(),ca=new Xt,ha=new Xt,iv=P(0,-1,0),Zl=new Xt,Kp=new Xt,nv=P(),Sr=P(),$p=P(),Qp=P(),Uh=new Xt,kh=new Xt,Nh=new Xt,Jl=new Xt,Kl=new Xt,rv=P(),av=P(),ef=P(),sv=new Ze,ov=[1,-1].map(i=>new Ze().makeBasis(P(0,-1,0),P(-i,0,0),P(0,0,-i)).transpose());cv=[{f:P(.1,.35,1),p:P(0,1,-.25)},{f:P(.3,-1,.05),p:P(0,.1,-1)}],hv=[1,-1].map(i=>new Xt().setFromRotationMatrix(new Ze().set(0,0,-i,0,0,-1,0,0,-i,0,0,0,0,0,0,1)));uv={grip:[[1.15,1.25],[1.2,1.3],[1.25,1.3],[1.3,1.3],[.5,.4]],pick:[[1.1,1.15],[1.2,1.1],[1.25,1.05],[1.3,1],[.8,.5]],fist:[[1.6,1.7],[1.6,1.7],[1.6,1.7],[1.6,1.7],[.6,.7]],open:[[.15,.1],[.1,.05],[.12,.08],[.2,.1],[.1,.1]],point:[[.05,0],[1.6,1.7],[1.6,1.7],[1.6,1.7],[.6,.6]],horns:[[.05,0],[1.6,1.7],[1.6,1.7],[.05,0],[.7,.8]]},nf={rootX:0,rootY:0,rootZ:0,rootYaw:0,hipX:0,hipZ:0,hipDrop:.04,pelvis:0,bodyYaw:0,bodyRoll:0,lean:.08,torsoYaw:0,torsoRoll:0,headPitch:0,headYaw:0,headRoll:0,gx:0,gy:0,gz:0,stance:0,fwdL:0,fwdR:0,liftL:0,liftR:0,mouth:0,brow:0,lid:.36,shake:0,kneel:0,ovS:0,ovF:0,lookCam:0,lookOpp:0,sneer:0,handS:"pick",handF:"grip"},Af=0,dv=1,Rf=2,pv=3,Cf=4,fv=5,qh=[6,8],mv=[7,9],fa=[10,12],gv=[11,13],vv=[14,31],Bh=[15,32],rc=.33,ac=.31,Oh=.5,rf=.47,$l=(i,e=.6)=>i<e?1-Oe(i/e):((i-e)/(1-e))**2,Cr=i=>(i=(i+Math.PI)%(Math.PI*2),i<0&&(i+=Math.PI*2),i-Math.PI),Rn=(i,e,t,n,r,a)=>Math.exp(-((i-t)**2)/(2*r*r)-(e-n)**2/(2*a*a));vo=class{constructor(){this.P=[],this.UV=[],this.SI=[],this.SW=[],this.C=[],this.I=[],this.M=[],this.n=0,this.seams=[]}vert(e,t,n,r,a,s,o,l){this.P.push(e,t,n),this.UV.push(r,a),s=s.filter(h=>h[1]>1e-4).sort((h,d)=>d[1]-h[1]).slice(0,4);let c=0;for(let h of s)c+=h[1];for(let h=0;h<4;h++)this.SI.push(s[h]?s[h][0]:0),this.SW.push(s[h]?s[h][1]/c:0);return l&&this.C.push(l.r,l.g,l.b),this.M.push(o),this.n++}grid(e,t,n){let r=this.n;for(let a=0;a<e;a++)for(let s=0;s<=t;s++)n(a,s);for(let a=0;a<e-1;a++)for(let s=0;s<t;s++){let o=r+a*(t+1)+s,l=o+1,c=o+t+1,h=c+1;this.I.push(o,l,c,l,h,c)}this.seams.push([r,e,t])}build(){let e=new ut;e.setAttribute("position",new He(this.P,3)),e.setAttribute("uv",new He(this.UV,2)),e.setAttribute("skinIndex",new rr(this.SI,4)),e.setAttribute("skinWeight",new He(this.SW,4)),this.C.length&&e.setAttribute("color",new He(this.C,3)),e.setIndex(this.I),e.computeVertexNormals();let t=e.attributes.normal;for(let[n,r,a]of this.seams)for(let s=0;s<r;s++){let o=n+s*(a+1),l=o+a,c=t.getX(o)+t.getX(l),h=t.getY(o)+t.getY(l),d=t.getZ(o)+t.getZ(l),u=Math.hypot(c,h,d)||1;t.setXYZ(o,c/u,h/u,d/u),t.setXYZ(l,c/u,h/u,d/u)}return{geo:e,meta:this.M}}};Di={x:.082,y:.416,ro:.122,ri:.07,ru:.096,rl:.07,h:.054};xv=`varying vec3 vRest; uniform float uSp, uBust;
float bustSh(float cl) {
  if (vRest.z < 0.0 || uBust <= 0.0) return 0.0;
  float x = vRest.x, y = vRest.y - uSp, sh = 0.0;
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0, dx = x - s * ${Di.x}, dy = y - ${Di.y};
    float d = length(vec2(dx / (dx * s > 0.0 ? ${Di.ro} : ${Di.ri}), dy / (dy > 0.0 ? ${Di.ru} : ${Di.rl})));
    sh = max(sh, smoothstep(0.78, 0.97, d) * (1.0 - smoothstep(1.0, 1.24, d)) * (1.0 - smoothstep(-0.035, 0.0, dy)));
    sh = max(sh, cl * 0.8 * smoothstep(0.56, 0.7, d) * (1.0 - smoothstep(0.72, 0.84, d)) * smoothstep(0.004, 0.026, dy) * (1.0 - smoothstep(0.1, 0.85, (dx * s) / ${Di.ro})));
  }
  float x1 = x / 0.009, x2 = x / 0.026, c = (0.85 * exp(-x1 * x1) + 0.3 * exp(-x2 * x2)) * smoothstep(0.35, 0.39, y) * (1.0 - smoothstep(0.485, 0.525, y));
  return clamp(max(sh, cl * c), 0.0, 1.0) * uBust;
}
`;Hh=new Map;ar={X:.085,Y0:-.135,Y1:.075},_v=[[0,.62],[.5,.55],[.9,.4],[1.18,.12],[1.36,-.12],[1.48,.18],[1.8,.1],[2.2,-.32],[Math.PI,-.58]];Mv=[[0,1],[.14,.995],[.28,.94],[.42,.83],[.56,.68],[.7,.52],[.82,.385],[.91,.27],[.97,.16],[1,0]],Sv=[[0,1],[.14,1],[.28,.975],[.42,.93],[.56,.87],[.7,.8],[.82,.69],[.91,.5],[.97,.25],[1,0]],Tv=[[0,1],[.25,.99],[.5,.955],[.7,.9],[.85,.83],[.94,.68],[1,0]],Ev=[[0,1],[.25,.99],[.5,.94],[.7,.86],[.85,.76],[.94,.58],[1,0]];Df=(i,e)=>e<.032?Ue(i.tY-.008,i.vm+.012,Oe(e/.032)):Ue(i.vm+.012,.006,Oe((e-.032)/.055));Rv=(()=>{let i=new qr(new Uint8Array([0,0,0,255]),1,1);return i.needsUpdate=!0,i})(),Cv=`
varying vec2 vFuv; varying vec4 vOvr; varying float vFw;
uniform sampler2D uFaceTex; uniform vec3 uSkin, uIris, uLash, uBrowC, uSclera;
uniform vec4 uEyeA, uEyeB, uLid, uGaze, uBrow, uBrowS, uFace;
uniform vec3 uIris2; uniform vec4 uIrisS, uBrowT;
uniform float uT; uniform sampler2D uGlowTex; uniform vec4 uGlowS; uniform vec3 uGlowA;
vec3 fEm;   // brillo propio (ojos y maquillaje legendarios)
float fh2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh2(i), fh2(i + vec2(1.0, 0.0)), f.x), mix(fh2(i + vec2(0.0, 1.0)), fh2(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 fhue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float aas(float e, float x, float w) { return smoothstep(e - w, e + w, x); }
float fdot2(vec2 v) { return dot(v, v); }
float fsdHeart(vec2 p) { p.x = abs(p.x); if (p.y + p.x > 1.0) return sqrt(fdot2(p - vec2(0.25, 0.75))) - 0.35355; return sqrt(min(fdot2(p - vec2(0.0, 1.0)), fdot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y); }
// l\xEDnea base entre lagrimal (m\xE1s bajo) y rabillo (m\xE1s alto)
float baseC(float qn) { return mix(-0.14 * uEyeA.w, uEyeB.y, qn * 0.5 + 0.5); }
float lidL0(float qn) { float e = max(0.0, 1.0 - qn * qn); return baseC(qn) - uEyeB.x * pow(e, 0.85) * (1.0 + 0.2 * qn); }
float lidU(float qn, float close) {
  float e = max(0.0, 1.0 - qn * qn);
  float u0 = baseC(qn) + uEyeA.w * pow(e, 0.62) * (1.0 - 0.1 * qn);
  return mix(u0, lidL0(qn) - 0.0002, close);
}
float lidL(float qn, float squint) { return mix(lidL0(qn), mix(lidL0(qn), lidU(qn, 0.0), 0.35), squint); }
float strokeD(vec2 p, vec2 a, vec2 dir, float L, out float h) { vec2 pa = p - a; h = clamp(dot(pa, dir) / L, 0.0, 1.0); return length(pa - dir * L * h); }
vec3 faceEye(vec3 col, vec2 P, float s, float close, float squint, vec2 gz, float raise, float angry, float aa) {
  float hw = uEyeA.z, hU = uEyeA.w, lk = uFace.w;
  float q = (P.x - s * uEyeA.x) * s, y = P.y - uEyeA.y, qn = q / hw, qc = clamp(qn, -1.0, 1.0);
  float yU = lidU(qc, close), yU0 = lidU(qc, 0.0), yLo = lidL(qc, squint);
  float inX = 1.0 - aas(1.0, abs(qn), aa / hw);
  float inside = aas(yLo, y, aa) * (1.0 - aas(yU, y, aa)) * inX;
  // globo: sombra bajo el p\xE1rpado y lagrimal rosado
  float shd = smoothstep(0.0, hU * 0.7, yU - y);
  vec3 ec = uSclera * mix(0.6, 1.0, shd);
  ec = mix(ec, vec3(0.92, 0.58, 0.58), smoothstep(-0.75, -0.97, qn) * 0.85);
  // iris con estr\xEDas, aro oscuro, pupila y brillos. Estilos: 0 cl\xE1sico, 1 brillo anime, 2 pupila coraz\xF3n, 3 pupila estrella, 4 degradado, 5 felino, 6 anillo, 7 heterocrom\xEDa, 8 fantasma
  float rI = uEyeB.z; vec2 ic = vec2(gz.x * s, gz.y + hU * 0.1), dI = vec2(q, y) - ic; float d = length(dI);
  int sty = int(uIrisS.x + 0.5);
  vec3 IC = (sty == 7 && s > 0.0) ? uIris2 : uIris;
  vec3 ir = mix(IC * 0.3, IC * 1.6 + 0.04, smoothstep(rI * 0.45, -rI * 0.95, dI.y));
  if (sty == 4) ir = mix(uIris2 * 1.5 + 0.05, IC * 0.45, smoothstep(-rI * 0.85, rI * 0.7, dI.y));
  if (sty == 1) ir += IC * 0.9 * smoothstep(rI * 0.95, rI * 0.5, d) * smoothstep(-rI * 0.1, -rI * 0.75, dI.y);
  ir *= 0.86 + 0.14 * sin(atan(dI.y, dI.x) * 13.0 + d * 1700.0);
  ir = mix(ir, IC * 0.2, smoothstep(rI * 0.72, rI, d));
  if (sty == 6) ir = mix(ir, uIris2 * 1.6 + 0.12, 1.0 - aas(rI * 0.075, abs(d - rI * 0.6), aa));
  // legendarios (animados): 9 rayo, 10 eclipse, 11 galaxia, 12 coraz\xF3n latiente
  vec3 iem = vec3(0.0); float bt = pow(max(0.0, sin(uT * 7.0)), 8.0) + 0.55 * pow(max(0.0, sin(uT * 7.0 - 0.9)), 8.0);   // latido doble
  if (sty >= 9) {
    float an = atan(dI.y, dI.x), r = d / rI;
    if (sty == 9) {   // rayos que saltan desde la pupila
      float j = floor(uT * 11.0 + s * 2.0), bo = 0.0;
      for (int k = 0; k < 5; k++) {
        float fk = float(k), ak = fk * 1.2566 + fh2(vec2(j, fk)) * 1.3, zig = (fn2(vec2(r * 7.0, j * 1.7 + fk * 5.0)) - 0.5) * 1.6 * r;
        float da = abs(mod(an - ak - zig + 3.14159, 6.28318) - 3.14159);
        bo = max(bo, (1.0 - smoothstep(0.0, 0.07, da * r)) * smoothstep(0.22, 0.4, r) * step(fh2(vec2(j * 1.3 + 2.0, fk)), 0.8));
      }
      ir = mix(IC * 0.22 + IC * 0.4 * smoothstep(0.55, 0.2, r), vec3(0.85, 0.95, 1.0), bo);
      iem = IC * (bo * 2.8 + 0.9 * smoothstep(0.5, 0.25, r) * (0.75 + 0.25 * sin(uT * 23.0)));
    } else if (sty == 10) {   // disco negro con una corona de fuego que gira
      float cr = 0.58 + 0.13 * fn2(vec2(an * 2.2 + uT * 1.4, uT * 0.6)) + 0.05 * sin(an * 9.0 - uT * 4.5);
      float ring = smoothstep(cr + 0.32, cr + 0.02, r) * smoothstep(cr - 0.04, cr + 0.02, r);
      vec3 cc = mix(uIris2 * 1.2, IC, smoothstep(cr, cr + 0.3, r));
      ir = mix(vec3(0.012, 0.008, 0.01), cc, ring);
      iem = cc * ring * 2.6 + uIris2 * (1.0 - smoothstep(0.0, 0.05, abs(r - cr + 0.02))) * 1.8;
    } else if (sty == 11) {   // nebulosa en espiral + estrellas que titilan
      float sw = an + r * 4.5 - uT * 0.7, nb = 0.5 + 0.5 * sin(sw * 3.0) * (0.55 + 0.45 * fn2(vec2(r * 6.0, an * 2.0 + uT * 0.3)));
      vec3 nc = mix(IC, uIris2, nb);
      ir = mix(vec3(0.03, 0.012, 0.08), nc, (0.3 + 0.7 * nb) * smoothstep(1.05, 0.25, r));
      vec2 sg = vec2((an + 3.14159) * 2.6 - uT * 0.45, r * 6.0), gi = floor(sg), gf = fract(sg) - 0.5;
      float sr = fh2(gi + s * 13.0), stw = smoothstep(0.2, 0.0, length(gf)) * step(0.5, sr) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (2.0 + sr * 4.0) + sr * 30.0), 3.0));
      ir += vec3(stw) + vec3(1.0) * smoothstep(0.2, 0.0, r);
      iem = nc * nb * 0.8 + vec3(stw) * 2.4 + vec3(1.0, 0.95, 1.0) * smoothstep(0.24, 0.0, r) * 1.8;
    } else if (sty == 12) {   // brillo que late + tres destellos que orbitan
      iem = IC * (0.25 + 0.5 * bt) * smoothstep(0.3, 1.0, r);
      for (int k = 0; k < 3; k++) {
        float a2 = uT * 1.6 + float(k) * 2.0944 + s; vec2 q2 = abs(dI - vec2(cos(a2), sin(a2)) * rI * 0.8);
        float gl = max(0.0, 1.0 - (q2.x * q2.y) / (rI * rI * 0.0016) - length(q2) / (rI * 0.22));
        ir += vec3(gl); iem += vec3(1.0) * gl * 2.0;
      }
    }
  }
  if (sty == 13) {   // v\xF3rtice: espiral de dos colores que gira y late
    float an = atan(dI.y, dI.x), r = d / rI, sp = sin(an * 2.0 + r * 15.0 - uT * 5.0), band = smoothstep(-0.25, 0.55, sp);
    vec3 cc = mix(IC, uIris2, 0.5 + 0.5 * sin(r * 5.0 - uT * 2.2));
    ir = mix(vec3(0.02, 0.01, 0.04), cc, band * smoothstep(1.05, 0.3, r));
    iem = cc * band * (1.0 + 0.7 * sin(uT * 4.0)) * smoothstep(1.0, 0.25, r);
  } else if (sty == 14) {   // prisma: facetas de caleidoscopio con arco\xEDris que gira y destellos
    float an = atan(dI.y, dI.x), r = d / rI, sg = 6.28318 / 6.0, a2 = abs(mod(an + uT * 0.35, sg) - sg * 0.5) / sg;
    float fc = fract(r * 2.6 + a2 * 1.4), facet = step(0.5, fc), edge = 1.0 - smoothstep(0.0, 0.06, min(fc, 1.0 - fc));
    vec3 cc = mix(mix(IC, uIris2, facet), fhue(an / 6.28318 + r * 0.6 - uT * 0.12), 0.4);
    ir = cc * (0.6 + 0.4 * facet) + vec3(edge * 0.35);
    iem = cc * (0.5 + 0.6 * facet) * smoothstep(1.0, 0.35, r) + vec3(1.0) * edge * 0.6 + vec3(1.0) * pow(max(0.0, sin(uT * 2.6 + an * 3.0)), 24.0) * smoothstep(0.3, 0.9, r) * 2.2;
  }
  float pd = d - rI * (sty == 6 ? 0.3 : sty == 9 ? 0.24 : 0.4); vec3 pc = vec3(0.015, 0.01, 0.02);
  if (sty == 2 || sty == 12) { float hk = rI * 0.62 * (sty == 12 ? 0.85 + 0.25 * bt : 1.0); pd = fsdHeart(dI / hk + vec2(0.0, 0.5)) * hk; pc = sty == 12 ? uIris2 * 1.3 + 0.12 : vec3(0.07, 0.0, 0.03); }
  if (sty == 10 || sty == 11) pd = 1.0;
  if (sty == 3) { float an = atan(dI.x, dI.y); pd = d - rI * 0.52 * (0.42 + 0.58 * pow(abs(cos(2.5 * an)), 2.5)); pc = uIris2 * 1.3 + 0.2; }
  if (sty == 5) pd = (length(dI / vec2(rI * 0.14, rI * 0.82)) - 1.0) * rI * 0.14;
  if (sty == 8) { ir = mix(vec3(0.96, 0.97, 1.0), IC * 0.7 + 0.35, smoothstep(rI * 0.1, rI, d)); pd = 1.0; }
  ir = mix(ir, pc, 1.0 - aas(0.0, pd, aa));
  if (sty == 12) iem += pc * (1.0 - aas(0.0, pd, aa)) * (0.7 + 2.4 * bt);
  ir *= mix(0.42, 1.0, shd);
  ec = mix(ec, ir, 1.0 - aas(rI, d, aa));
  fEm += iem * (1.0 - aas(rI, d, aa)) * inside * mix(0.55, 1.0, shd);
  ec = mix(ec, vec3(1.0), 1.0 - aas(rI * 0.21, length((dI - vec2(0.3 * rI * s, 0.34 * rI)) * vec2(1.0, 0.85)), aa));
  ec = mix(ec, vec3(1.0), (1.0 - aas(rI * 0.085, length(dI - vec2(-0.32 * rI * s, -0.42 * rI)), aa)) * 0.85);
  if (sty == 1) ec = mix(ec, vec3(1.0), (1.0 - aas(rI * 0.065, length(dI - vec2(0.05 * rI * s, -0.62 * rI)), aa)) * 0.8);
  col = mix(col, ec, inside);
  // pliegue del p\xE1rpado
  float cy = mix(yU0, yU, 0.35) + 0.0048;
  col = mix(col, col * vec3(0.7, 0.58, 0.58), (1.0 - aas(0.00042, abs(y - cy), aa)) * smoothstep(1.0, 0.45, abs(qn - 0.2)) * 0.75);
  // delineado superior que engorda hacia fuera y termina en rabillo
  float tl = lk * mix(0.0008, 0.0025, smoothstep(-0.9, 0.95, qn)), dd = y - yU;
  float liner = aas(-0.3 * tl, dd, aa) * (1.0 - aas(tl, dd, aa)) * (1.0 - aas(1.02, abs(qn), aa / hw));
  float wl = 0.62 * hw * uEyeB.w, tipX = hw + wl, tipY = baseC(1.0) + wl * 0.62;
  float a0 = 0.66 * hw, yTop0 = lidU(0.66, close) + lk * 0.0022;
  float wu = mix(yTop0, tipY, clamp((q - a0) / max(1e-5, tipX - a0), 0.0, 1.0));
  float wlo = q < hw ? lidU(qc, close) : mix(baseC(1.0), tipY, (q - hw) / max(1e-5, wl));
  float wing = aas(wlo, y, aa) * (1.0 - aas(wu, y, aa)) * aas(a0, q, aa) * (1.0 - aas(tipX, q, aa)) * step(0.001, uEyeB.w);
  col = mix(col, uLash, max(liner, wing));
  // pesta\xF1as: curvas (dos tramos), m\xE1s largas hacia fuera; dos m\xE1s saliendo del rabillo
  if (lk > 0.8) {
    float LL = uBrowS.w, best = 1.0;
    for (int i = 0; i < 9; i++) {
      float fi = float(i) / 8.0, qi = mix(-0.25, 0.97, fi), tli = mix(0.001, 0.003, smoothstep(-0.9, 0.95, qi));
      vec2 a = vec2(qi * hw, lidU(qi, close) + tli * 0.55);
      float an = mix(0.25, 1.05, fi) + close * 1.6;                       // \xE1ngulo desde la vertical, hacia fuera
      vec2 d1 = vec2(sin(an), cos(an)), d2 = vec2(sin(an + 0.55), cos(an + 0.55));
      float L = (0.0022 + 0.0042 * fi) * LL, h1, h2;
      float s1 = strokeD(vec2(q, y), a, d1, L * 0.55, h1), s2 = strokeD(vec2(q, y), a + d1 * L * 0.55, d2, L * 0.5, h2);
      best = min(best, min(s1 - mix(0.0009, 0.00055, h1), s2 - mix(0.00055, 0.00006, h2)));
    }
    if (uEyeB.w > 0.0) for (int i = 0; i < 2; i++) {
      float fi = float(i); vec2 a = vec2(hw * (1.0 + 0.35 * uEyeB.w * (0.4 + 0.5 * fi)), baseC(1.0) + 0.0018 + fi * 0.0012 * uEyeB.w);
      float an = 1.15 + 0.2 * fi + close * 0.8, L = (0.004 + 0.0012 * fi) * LL, h1, h2;
      vec2 d1 = vec2(sin(an), cos(an)), d2 = vec2(sin(an + 0.5), cos(an + 0.5));
      float s1 = strokeD(vec2(q, y), a, d1, L * 0.55, h1), s2 = strokeD(vec2(q, y), a + d1 * L * 0.55, d2, L * 0.5, h2);
      best = min(best, min(s1 - mix(0.00085, 0.0005, h1), s2 - mix(0.0005, 0.00006, h2)));
    }
    col = mix(col, uLash, 1.0 - aas(0.0, best, aa));
    for (int i = 0; i < 4; i++) {
      float qi = 0.3 + 0.2 * float(i); vec2 a = vec2(qi * hw, lidL(qi, squint));
      float h, sd = strokeD(vec2(q, y), a, normalize(vec2(0.35 + 0.25 * float(i), -1.0)), (0.0014 + 0.0005 * float(i)) * LL * 0.7, h);
      col = mix(col, uLash, (1.0 - aas(mix(0.00045, 0.00006, h), sd, aa)) * (1.0 - close));
    }
  }
  // l\xEDnea inferior
  float dl = yLo - y, lw = 0.00028 + 0.00035 * smoothstep(-0.3, 1.0, qn);
  col = mix(col, mix(uLash, col, 0.3), aas(-0.0001, dl, aa) * (1.0 - aas(lw, dl, aa)) * smoothstep(-0.6, 0.2, qn) * inX * (1.0 - close));
  // ceja: cabeza redondeada, arco alto, cola afilada, con textura de pelo
  float bq0 = -1.05 * hw, bq1 = 1.32 * hw * uBrowT.w, t = (q - bq0) / (bq1 - bq0), tc = clamp(t, 0.0, 1.0);
  float by = baseC(0.0) + hU + uBrowS.x + raise;
  float yc = by + uBrowS.z * sin(3.14159 * pow(tc, 1.7)) - 0.0012 * tc - angry * (1.0 - tc) * 0.0055 + angry * 0.001 * tc;
  float T = uBrowS.y * mix(0.6, 1.0, sqrt(clamp(tc / 0.14, 0.0, 1.0))) * mix(1.0, mix(0.16, 0.62, uBrowT.x), smoothstep(0.5, 1.0, tc));
  float rough = uBrowT.z * 0.0011 * (sin(q * 5200.0) * 0.6 + sin(q * 2900.0 + 1.3) * 0.4);   // ceja poblada: borde irregular
  float yl = yc - T * 0.42 - rough * 0.6, yh = yc + T * 0.58 + rough;
  float rnd0 = (y - yc) / max(T, 1e-5) * 2.0;   // cabeza de la ceja redondeada
  float ends = aas(0.0, t - 0.05 * rnd0 * rnd0, 0.015) * (1.0 - aas(1.0, t, 0.02));
  ends *= 1.0 - uBrowT.y * (1.0 - aas(0.028, abs(t - 0.64), 0.01));   // corte en la ceja
  float bm = aas(yl, y, aa * 1.3) * (1.0 - aas(yh, y, aa * 1.3)) * ends;
  float hairs = 0.84 + 0.16 * sin((q * (1.0 - tc * 0.6) + (y - yl) * (0.9 - tc * 0.6)) * 3600.0);
  col = mix(col, uBrowC * hairs, bm * mix(0.78, 1.0, smoothstep(0.0, 0.22, t)));
  return col;
}
vec3 facePaint() {
  fEm = vec3(0.0);
  vec2 P = vec2(mix(-uFace.x, uFace.x, vFuv.x), mix(uFace.y, uFace.z, vFuv.y));
  vec3 col = mix(uSkin, texture2D(uFaceTex, clamp(vFuv, 0.0, 1.0)).rgb, vFw);
  float aa = max(fwidth(P.x), fwidth(P.y)) * 0.75;
  if (uGlowS.x > 0.5 && vFw > 0.01) {   // maquillaje legendario: m\xE1scara pintada (r = zona, g/b = fase y destellos), animada aqu\xED
    vec4 gm = texture2D(uGlowTex, clamp(vFuv, 0.0, 1.0)); int md = int(uGlowS.x + 0.5); vec3 ge = vec3(0.0);
    if (md == 1) { float pu = 0.6 + 0.4 * sin(uT * 3.2); col = mix(col, uGlowA * 0.55 + 0.45, gm.r * 0.9); ge = uGlowA * gm.r * (1.0 + 1.8 * pu); }
    else if (md == 2) { float w = 0.5 + 0.5 * sin(uT * 3.0 - vFuv.y * 16.0 + vFuv.x * 5.0), fl = 0.8 + 0.2 * fn2(vec2(uT * 9.0, vFuv.x * 30.0)); col = mix(col, mix(uGlowA, vec3(1.0, 0.85, 0.4), 0.25 * w), gm.r * 0.95); ge = uGlowA * gm.r * (1.3 + 2.8 * w) * fl; }
    else if (md == 3) { float tw = pow(max(0.0, sin(uT * 2.4 + gm.g * 40.0)), 12.0); col = mix(col, mix(uGlowA, vec3(1.0), 0.5 + 0.3 * gm.b), gm.r); ge = uGlowA * gm.r * (0.8 + 0.4 * sin(uT * 2.0 + gm.g * 9.0)) + vec3(1.0) * gm.r * tw * 3.5; }
    else if (md == 5) { float fl = 0.5 + 0.5 * sin(uT * 2.2 - vFuv.y * 22.0 + vFuv.x * 4.0); col = mix(col, mix(uGlowA, vec3(1.0, 0.9, 0.5), 0.4 * fl), gm.r); ge = uGlowA * gm.r * (1.1 + 2.6 * fl) * (0.85 + 0.15 * fn2(vec2(uT * 7.0, vFuv.x * 40.0))); }
    else if (md == 6) { float fl = 0.5 + 0.5 * sin(uT * 3.6 + gm.g * 6.28); vec3 ac = mix(uGlowA, fhue(gm.g * 0.5 + uT * 0.06), 0.35); col = mix(col, ac, gm.r * (0.5 + 0.3 * fl)); ge = ac * gm.r * (0.5 + 1.5 * fl) + vec3(1.0) * gm.b * pow(max(0.0, sin(uT * 3.0 + gm.b * 60.0)), 10.0) * 3.0; }
    else { vec3 ac = mix(uGlowA, fhue(vFuv.x * 1.3 + vFuv.y * 0.9 - uT * 0.1), 0.65); col = mix(col, ac, gm.r * 0.72); ge = ac * gm.r * (0.8 + 0.5 * sin(uT * 1.8 + vFuv.x * 12.0)) + vec3(1.0) * gm.g * pow(max(0.0, sin(uT * 3.0 + gm.b * 60.0)), 10.0) * 3.0; }
    fEm += ge * vFw;
  }
  if (vFw > 0.01) {
    vec3 e0 = fEm;
    vec3 c2 = faceEye(col, P, -1.0, uLid.x, uLid.z, uGaze.xy, uBrow.x, uBrow.z, aa);
    c2 = faceEye(c2, P, 1.0, uLid.y, uLid.w, uGaze.zw, uBrow.y, uBrow.w, aa);
    col = mix(col, c2, vFw); fEm = e0 + (fEm - e0) * vFw;
  }
  return mix(col, vOvr.rgb, vOvr.a);
}`;of={},Ri=i=>typeof i=="string"?i:"#"+new ke(i).getHexString(),Lr=(i,e)=>of[i]||(of[i]=e()),Uf=(i,e=[2,3])=>Lr("plaid"+i+e,()=>ft(64,64,t=>{t.fillStyle=Ri(i),t.fillRect(0,0,64,64),t.fillStyle="rgba(0,0,0,.45)",t.fillRect(0,20,64,10),t.fillRect(20,0,10,64),t.fillStyle="rgba(0,0,0,.3)",t.fillRect(0,48,64,4),t.fillRect(48,0,4,64),t.fillStyle="rgba(255,220,80,.7)",t.fillRect(0,40,64,2),t.fillRect(40,0,2,64)},{repeat:e})),Iv=(i,e)=>Lr("ss"+i+e,()=>ft(64,16,t=>{t.fillStyle=Ri(i),t.fillRect(0,0,64,16),t.fillStyle=Ri(e);for(let n of[16,48])t.fillRect(n-2.5,0,5,16)},{repeat:[1,1]})),Dv=(i,e)=>Lr("ks"+i+e,()=>ft(16,64,t=>{t.fillStyle=Ri(i),t.fillRect(0,0,16,64),t.fillStyle=Ri(e),t.fillRect(0,33,16,4),t.fillRect(0,40,16,4)},{repeat:[1,1]})),kf=()=>Lr("net",()=>ft(64,64,i=>{i.strokeStyle="#fff",i.lineWidth=8;for(let e of[-64,0,64])i.beginPath(),i.moveTo(e,0),i.lineTo(e+64,64),i.stroke(),i.beginPath(),i.moveTo(e+64,0),i.lineTo(e,64),i.stroke()},{repeat:[14,20]})),Uv=i=>Lr("corset"+i,()=>ft(512,256,e=>{e.fillStyle=Ri(i),e.fillRect(0,0,512,256),e.strokeStyle="rgba(0,0,0,.3)",e.lineWidth=3;for(let t=0;t<16;t++){if(t===8)continue;let n=t*32;e.beginPath(),e.moveTo(n,0),e.lineTo(n,256),e.stroke()}e.fillStyle="#120c12",e.fillRect(244,0,24,256),e.strokeStyle="#f2ece6",e.lineWidth=4;for(let t=6;t<256;t+=22)e.beginPath(),e.moveTo(240,t),e.lineTo(272,t+18),e.moveTo(272,t),e.lineTo(240,t+18),e.stroke();e.fillStyle="#d0d0d8";for(let t=6;t<256;t+=22)for(let n of[238,274])e.beginPath(),e.arc(n,t,3.5,0,7),e.fill()})),kv={skirt:{HL:.315,flare:.075,pleat:.045},skirtPlaid:{HL:.3,flare:.07,pleat:.04,plaid:!0},mini:{HL:.2,flare:.022,pleat:0},faldaGalaxia:{HL:.3,flare:.085,pleat:.04,leg:["galaxy",2808063,8]},faldaFuego:{HL:.3,flare:.08,pleat:.045,leg:["fire",16764992,8]}},Nv={botasInfierno:["boot","lava",16734736],botasCromo:["boot","chrome",16777215],cristal:["platform","crystal",16777215],botasHolo:["tallboots","holo",16777215],zapasNeon:["sneaker","neon",3866576],botasFuego:["tallboots","fire",16764992]},Nf={barbaFuego:["fire",16764992,34],escarcha:["crystal",16777215,40],barbaRayo:["electric",10152191,34]},Bv={furia:{base:"furia",fx:"chrome",sc:30,k:1.3,aura:"spark",box:[0,.14,-.03,.25,.36,.25]},trueno:{base:"mohawk",fx:"electric",sc:26,aura:"bolt",box:[0,.14,-.05,.19,.38,.3]},galaxiaH:{base:"longF",fx:"galaxy",sc:16,aura:"star",box:[0,-.1,-.06,.26,.5,.26],shell:!1,n:90},neonTw:{base:"pigtails",fx:"neon",sc:24,aura:"heart",box:[0,-.08,-.03,.36,.48,.24],shell:!1,n:80},llamarada:{base:"spiky",fx:"fire",sc:26,aura:"spark",box:[0,.14,-.03,.22,.34,.24]},fenixH:{base:"ponytail",fx:"fire",sc:22,aura:"spark",box:[0,0,-.1,.24,.42,.3],shell:!1,n:70}},Ov={boot:"boot",chelsea:"boot",sneaker:"sneaker",hightops:"sneaker",platform:"platform",tallboots:"platform"},Mi=(i,e,t)=>i.part===0&&i.s>=e&&i.s<=t,zn=(i,e,t)=>(i.part===1||i.part===2)&&i.s<=e&&i.s>=t,Ui=(i,e,t)=>(i.part===3||i.part===4)&&i.s<=e&&i.s>=t,ds={tank:i=>[{clip:e=>{if(e.part!==0)return-1;let t=Se(.5+Math.cos(e.a)*1.5,0,1),n=Ue(.53,.47,t)-Ue(.02,.06,t)*Math.exp(-((e.x/.075)**2)),r=Math.min(n-e.s,e.s+.03),a=Math.min(.036-Math.abs(Math.abs(e.x)-.105),(e.w-.09)*2);return Math.max(r,a)},inf:.006,color:i.color}],tee:i=>[{pred:e=>Mi(e,-.07,.62)||zn(e,.09,-.15),inf:e=>e.part===0?.008:.01+.012*Se(-e.s/.15,0,1),color:i.color}],longsleeve:i=>[{pred:e=>Mi(e,-.07,.62)||zn(e,.09,-.6),inf:.009,color:i.color}],jacket:i=>[{pred:e=>Mi(e,-.09,.64)||zn(e,.09,-.58),inf:e=>e.part===0?.012:.012+.01*Se((-e.s-.4)/.18,0,1),color:i.color}],crop:i=>[{clip:e=>{if(e.part!==0)return-1;let t=Se(.5+Math.cos(e.a)*1.5,0,1),n=Math.abs(e.x),r=Ue(.51,.476,t)+t*.012*Math.exp(-((n-.08)**2)/.001)-t*.03*Math.exp(-(e.x*e.x)/6e-4);return Math.max(Math.min(r-e.s,e.s-.265),Math.min(.018-Math.abs(n-.092),(e.s-.4)*2))},inf:.006,color:i.color}],corset:i=>[{clip:e=>{if(e.part!==0)return-1;let t=Se(.5+Math.cos(e.a)*1.5,0,1),n=Math.abs(e.x),r=Ue(.5,.464,t)+t*.016*Math.exp(-((n-.082)**2)/.0012)-t*.024*Math.exp(-(e.x*e.x)/5e-4);return Math.min(r-e.s,e.s+.01)},inf:.008,color:16777215,map:Uv(i.color??7999520)}],leather:i=>[{pred:e=>Mi(e,-.1,.62)&&!(Math.abs(e.a)<.42&&e.s<.53)||zn(e,.09,-.6),inf:e=>e.part===0?.017:.014,color:i.color},{pred:e=>Mi(e,-.05,.6),inf:.006,color:16777215,map:We.skullTee}],infernal:i=>{let e=ds.leather(i);return e[0].leg=["lava",i.color??1707016,16734736,9],e},cromo:i=>[{pred:e=>Mi(e,-.07,.62)||zn(e,.09,-.6),inf:e=>e.part===0?.011:.01,color:i.color,leg:["chrome",i.color??9081510,16777215,5]}],diamante:i=>{let e=ds.corset({color:16777215});return e[0].leg=["glitter",i.color??13156592,16777215,1],e},holoTop:i=>{let e=ds.crop(i);return e[0].leg=["holo",i.color??15261951,16777215,5],e},neonTank:i=>{let e=ds.tank(i);return e[0].leg=["neon",i.color??789014,3866576,5],e},chaquetaNeon:i=>{let e=ds.jacket(i);return e[0].leg=["neon",i.color??1314846,i.accent??16726682,5],e}},Tr={jeans:i=>[{pred:e=>Mi(e,-.2,.075)||Ui(e,.12,-.955),inf:e=>e.part===0?.012:.013+.018*Se((-e.s-.55)/.4,0,1),color:i.color??4874118,map:We.denim}],jeansRips:i=>Tr.jeans(i),plaid:i=>[{pred:e=>Mi(e,-.2,.075)||Ui(e,.12,-.955),inf:e=>e.part===0?.013:.014+.008*Se((-e.s-.55)/.4,0,1),color:16777215,map:i.color===void 0?We.plaid:Uf(i.color)}],pitillo:i=>[{pred:e=>Mi(e,-.2,.08)||Ui(e,.12,-.955),inf:e=>e.part===0?.008:.006,color:16777215,map:Iv(i.color??1447446,i.color2??16730778)}],shortsF:i=>[{pred:e=>Mi(e,-.2,.12)||Ui(e,.12,-.1),inf:e=>e.part===0?.008:.009,color:i.color??5929648,map:We.denim}],leatherPants:i=>[{pred:e=>Mi(e,-.2,.075)||Ui(e,.12,-.955),inf:e=>e.part===0?.01:.009,color:ei(i.color??1710622,.5)}],shorts:i=>[{pred:e=>Mi(e,-.2,.075)||Ui(e,.12,-.3),inf:e=>e.part===0?.014:.016+.02*Se(-e.s/.3,0,1),color:i.color}],skirt:i=>[{pred:e=>Mi(e,-.2,.04),inf:.006,color:ei(i.color??1447446,.6)}],skirtPlaid:i=>Tr.skirt(i),mini:i=>Tr.skirt(i),magma:i=>[{...Tr.jeans(i)[0],map:null,leg:["lava",i.color??1838858,16738842,8]}],tormenta:i=>[{...Tr.leatherPants(i)[0],leg:["electric",i.color??1053738,7002367,6]}],pitilloHolo:i=>[{...Tr.pitillo(i)[0],map:null,leg:["holo",i.color??14735615,16777215,6]}],faldaGalaxia:i=>[{pred:e=>Mi(e,-.2,.04),inf:.006,color:1118481,leg:["galaxy",i.color??6957752,2808063,8]}],faldaFuego:i=>[{pred:e=>Mi(e,-.2,.04),inf:.006,color:1118481,leg:["fire",i.color??2754565,16764992,8]}],jeansGalaxia:i=>[{...Tr.jeans(i)[0],map:null,leg:["galaxy",i.color??1708112,3856639,8]}]},sc={stockings:i=>[{pred:e=>Ui(e,-.16,-.985),inf:.003,color:16777215,map:Tf(i.a??Ri(i.color??6481980),i.b??Ri(i.color2??1118481),8,[1,4])}],red:i=>[{pred:e=>Mi(e,-.2,.05)||Ui(e,.12,-.985),inf:.0025,color:i.color??1118481,map:kf(),sheer:!0}],calcetas:i=>[{pred:e=>Ui(e,-.5,-.985),inf:.004,color:16777215,map:Dv(i.color??16777215,i.color2??1118481)}],tights:i=>[{pred:e=>Mi(e,-.2,.05)||Ui(e,.12,-.985),inf:.003,color:i.color??1447446}],socks:i=>[{pred:e=>Ui(e,-.84,-.985),inf:.004,color:i.color??16777215}],brillantina:i=>[{...sc.tights(i)[0],leg:["glitter",i.color??2758208,16763120,1]}],redNeon:i=>[{...sc.red(i)[0],leg:["neon",i.color??16726682,3856639,5]}],mediasRayo:i=>[{...sc.tights(i)[0],leg:["electric",i.color??1053738,7002367,4]}]},Ai="#1a1018",kt=(i,e,t,n=9)=>{t&&(i.fillStyle=t,i.fill(e)),i.lineJoin="round",i.lineCap="round",i.lineWidth=n,i.strokeStyle=Ai,i.stroke(e)},Vn={calavera:(i,e)=>{let t=new Path2D;t.arc(128,104,72,Math.PI*.85,Math.PI*.15),t.lineTo(176,168),t.lineTo(168,206),t.lineTo(88,206),t.lineTo(80,168),t.closePath(),kt(i,t,e),i.fillStyle=Ai;for(let n of[-1,1])i.beginPath(),i.ellipse(128+n*30,118,21,24,n*.2,0,7),i.fill();i.beginPath(),i.moveTo(128,140),i.lineTo(117,163),i.lineTo(139,163),i.closePath(),i.fill(),i.lineWidth=6,i.strokeStyle=Ai;for(let n of[106,120,136,150])i.beginPath(),i.moveTo(n,182),i.lineTo(n,206),i.stroke();i.beginPath(),i.moveTo(92,182),i.lineTo(164,182),i.stroke()},llamas:(i,e)=>{let t=(n,r,a,s)=>{let o=new Path2D;o.moveTo(n-r,240),o.bezierCurveTo(n-r*1.3,240-a*.45,n-r*.1,240-a*.6,n+r*.15,240-a),o.bezierCurveTo(n+r*.2,240-a*.6,n+r*1.3,240-a*.5,n+r,240),o.closePath(),kt(i,o,s,7)};t(80,46,150,e),t(176,46,170,e),t(128,58,225,e),t(128,28,110,"#ffd23a"),t(84,20,70,"#ffd23a"),t(172,20,80,"#ffd23a")},tribal:(i,e)=>{let t=n=>{let r=new Path2D;r.moveTo(...n[0]),r.bezierCurveTo(...n[1],...n[2],...n[3]),r.bezierCurveTo(...n[4],...n[5],...n[0]),kt(i,r,e,3)};t([[128,18],[206,70],[192,156],[128,238],[152,150],[162,82]]),t([[128,18],[50,70],[64,156],[128,238],[104,150],[94,82]]),t([[22,120],[76,84],[112,108],[128,132],[98,124],[66,112]]),t([[234,120],[180,84],[144,108],[128,132],[158,124],[190,112]])},serpiente:(i,e)=>{let t=new Path2D;t.moveTo(70,238),t.bezierCurveTo(210,200,36,146,150,112),t.bezierCurveTo(212,92,172,54,124,54),i.lineCap="round",i.lineWidth=34,i.strokeStyle=Ai,i.stroke(t),i.lineWidth=22,i.strokeStyle=e,i.stroke(t),i.lineWidth=3,i.strokeStyle="rgba(0,0,0,.4)",i.setLineDash([5,10]),i.stroke(t),i.setLineDash([]);let n=new Path2D;n.ellipse(106,52,27,18,-.2,0,7),kt(i,n,e,7),i.fillStyle="#ffd23a",i.beginPath(),i.arc(98,45,5.5,0,7),i.fill(),i.fillStyle=Ai,i.fillRect(97,41,2.5,8),i.strokeStyle="#d8262b",i.lineWidth=4,i.beginPath(),i.moveTo(80,58),i.lineTo(60,64),i.lineTo(50,58),i.moveTo(60,64),i.lineTo(52,72),i.stroke()},estrellas:(i,e)=>{for(let[t,n,r]of[[128,96,64],[60,196,34],[196,188,28]]){let a=new Path2D;for(let s=0;s<10;s++){let o=-Math.PI/2+s*Math.PI/5,l=s%2?r*.45:r;s?a.lineTo(t+Math.cos(o)*l,n+Math.sin(o)*l):a.moveTo(t+Math.cos(o)*l,n+Math.sin(o)*l)}a.closePath(),kt(i,a,e,7)}},corazon:(i,e)=>{let t=new Path2D;t.moveTo(128,222),t.bezierCurveTo(40,160,20,100,56,64),t.bezierCurveTo(88,34,122,52,128,82),t.bezierCurveTo(134,52,168,34,200,64),t.bezierCurveTo(236,100,216,160,128,222),t.closePath(),kt(i,t,e),i.fillStyle="rgba(255,255,255,.5)",i.beginPath(),i.ellipse(80,90,12,22,-.6,0,7),i.fill();let n=new Path2D;n.moveTo(22,122),n.lineTo(234,122),n.lineTo(220,142),n.lineTo(234,162),n.lineTo(22,162),n.lineTo(36,142),n.closePath(),kt(i,n,"#f4ecd8",6),i.fillStyle=Ai,i.font="34px Bangers, Impact, sans-serif",i.textAlign="center",i.textBaseline="middle",i.fillText("ROCK",128,144)},rosa:(i,e)=>{let t=(r,a,s)=>{i.save(),i.translate(r,a),i.rotate(s);let o=new Path2D;o.moveTo(0,0),o.quadraticCurveTo(30,-26,70,0),o.quadraticCurveTo(30,26,0,0),kt(i,o,"#3a9a3a",6),i.restore()};i.lineWidth=9,i.strokeStyle=Ai,i.beginPath(),i.moveTo(128,150),i.quadraticCurveTo(118,200,132,242),i.stroke(),t(126,186,.45),t(130,200,Math.PI-.5);let n=new Path2D;n.arc(128,100,64,0,7),kt(i,n,e),i.lineWidth=6,i.strokeStyle=Ai;for(let[r,a,s]of[[46,3.6,6.9],[32,.4,3.9],[19,3,6.3],[8,0,5]])i.beginPath(),i.arc(128,100,r,a,s),i.stroke()},murcielago:(i,e)=>{let t=new Path2D;t.moveTo(116,96),t.lineTo(120,72),t.lineTo(128,88),t.lineTo(136,72),t.lineTo(140,96),t.quadraticCurveTo(190,66,246,86),t.quadraticCurveTo(222,108,228,142),t.quadraticCurveTo(202,124,188,152),t.quadraticCurveTo(170,132,150,160),t.quadraticCurveTo(140,172,128,190),t.quadraticCurveTo(116,172,106,160),t.quadraticCurveTo(86,132,68,152),t.quadraticCurveTo(54,124,28,142),t.quadraticCurveTo(34,108,10,86),t.quadraticCurveTo(66,66,116,96),t.closePath(),kt(i,t,e,7),i.fillStyle="#fff";for(let n of[-1,1])i.beginPath(),i.arc(128+n*8,108,4,0,7),i.fill()},golondrina:(i,e)=>{let t=new Path2D;t.moveTo(118,118),t.quadraticCurveTo(90,172,38,204),t.quadraticCurveTo(100,184,142,132),t.closePath(),kt(i,t,e,7);let n=new Path2D;n.moveTo(58,108),n.quadraticCurveTo(90,84,130,110),n.quadraticCurveTo(172,132,216,198),n.lineTo(186,170),n.lineTo(196,216),n.quadraticCurveTo(150,162,100,148),n.quadraticCurveTo(64,138,58,108),n.closePath(),kt(i,n,e,7);let r=new Path2D;r.moveTo(74,128),r.quadraticCurveTo(110,152,152,154),r.quadraticCurveTo(110,132,90,120),r.closePath(),kt(i,r,"#f4ecd8",4);let a=new Path2D;a.moveTo(118,116),a.quadraticCurveTo(150,38,238,28),a.quadraticCurveTo(190,80,168,132),a.closePath(),kt(i,a,e,7),i.fillStyle="#d8262b",i.beginPath(),i.arc(72,114,8,0,7),i.fill(),i.fillStyle=Ai,i.beginPath(),i.arc(78,104,4,0,7),i.fill(),i.beginPath(),i.moveTo(60,104),i.lineTo(40,110),i.lineTo(60,114),i.fill()},dragon:(i,e)=>{let t=[[40,230],[230,220],[230,120],[130,128],[40,136],[40,60],[150,52]],n=(c,h,d,u,p)=>{let m=1-p;return[0,1].map(g=>m*m*m*c[g]+3*m*m*p*h[g]+3*m*p*p*d[g]+p*p*p*u[g])},r=c=>c<.5?n(t[0],t[1],t[2],t[3],c*2):n(t[3],t[4],t[5],t[6],c*2-1);for(let c=1;c<14;c++){let h=c/14,d=r(h),u=r(h+.01),p=u[0]-d[0],m=u[1]-d[1],g=Math.hypot(p,m)||1,f=20-h*8,y=new Path2D;y.moveTo(d[0]-p/g*9,d[1]-m/g*9),y.lineTo(d[0]+m/g*f*1.5,d[1]-p/g*f*1.5),y.lineTo(d[0]+p/g*9,d[1]+m/g*9),y.closePath(),kt(i,y,"#ffd23a",5)}let a=new Path2D;a.moveTo(...t[0]),a.bezierCurveTo(...t[1],...t[2],...t[3]),a.bezierCurveTo(...t[4],...t[5],...t[6]),i.lineCap="round",i.lineWidth=38,i.strokeStyle=Ai,i.stroke(a),i.lineWidth=26,i.strokeStyle=e,i.stroke(a),i.lineWidth=3,i.strokeStyle="rgba(0,0,0,.45)",i.setLineDash([4,9]),i.stroke(a),i.setLineDash([]);let s=new Path2D;s.moveTo(140,36),s.lineTo(196,40),s.lineTo(214,56),s.lineTo(188,62),s.lineTo(204,74),s.lineTo(150,74),s.closePath(),kt(i,s,e,7);let o=new Path2D;o.moveTo(150,40),o.quadraticCurveTo(140,10,112,8),o.quadraticCurveTo(136,22,140,44),kt(i,o,"#f4ecd8",5),i.fillStyle="#ffd23a",i.beginPath(),i.arc(172,50,5,0,7),i.fill(),i.fillStyle=Ai,i.fillRect(171,46,2.5,8);let l=new Path2D;l.moveTo(206,62),l.quadraticCurveTo(236,50,252,66),l.quadraticCurveTo(236,70,248,84),l.quadraticCurveTo(228,80,206,70),l.closePath(),kt(i,l,"#ff8a2a",5)},fenix:(i,e)=>{let t=(s,o,l,c,h,d)=>{i.save(),i.translate(s,o),i.rotate(l);let u=new Path2D;u.moveTo(0,0),u.bezierCurveTo(h,-c*.3,h*.6,-c*.75,0,-c),u.bezierCurveTo(-h*.2,-c*.7,-h*.9,-c*.35,0,0),kt(i,u,d,5),i.restore()};for(let s of[-1,1])for(let o=0;o<5;o++)t(128+s*14,120,s*(.55+o*.28),92-o*9,26,o%2?"#ffd23a":e);for(let s=-2;s<=2;s++)t(128,150,Math.PI+s*.28,86-Math.abs(s)*10,20,s%2?e:"#ffd23a");let n=new Path2D;n.ellipse(128,128,22,34,0,0,7),kt(i,n,e,7);let r=new Path2D;r.arc(128,86,15,0,7),kt(i,r,e,7);let a=new Path2D;a.moveTo(122,92),a.lineTo(128,108),a.lineTo(134,92),a.closePath(),kt(i,a,"#ffd23a",4);for(let s of[-1,1])t(128+s*4,74,s*.4,30,9,"#ffd23a");i.fillStyle=Ai;for(let s of[-1,1])i.beginPath(),i.arc(128+s*6,84,2.6,0,7),i.fill()},mariposaT:(i,e)=>{let t=(r,a)=>{let s=new Path2D;a?(s.moveTo(128,120),s.bezierCurveTo(128+r*40,30,128+r*120,20,128+r*112,80),s.bezierCurveTo(128+r*108,112,128+r*60,124,128,124)):(s.moveTo(128,128),s.bezierCurveTo(128+r*90,126,128+r*100,190,128+r*66,214),s.bezierCurveTo(128+r*40,230,128+r*14,190,128,132)),s.closePath(),kt(i,s,e,7)};for(let r of[-1,1])t(r,!0),t(r,!1);for(let r of[-1,1])for(let[a,s,o]of[[50,70,13],[76,92,7],[58,176,10]]){let l=new Path2D;l.arc(128+r*a,s,o,0,7),kt(i,l,"rgba(255,255,255,.9)",4)}let n=new Path2D;n.ellipse(128,132,9,48,0,0,7),kt(i,n,"#2a1a3a",6),i.lineWidth=5,i.strokeStyle=Ai,i.lineCap="round";for(let r of[-1,1])i.beginPath(),i.moveTo(128,90),i.quadraticCurveTo(128+r*10,52,128+r*30,44),i.stroke(),i.fillStyle=Ai,i.beginPath(),i.arc(128+r*30,44,5,0,7),i.fill()},lunaT:(i,e)=>{let t=go(256,256),n=t.getContext("2d");n.fillStyle=Ai,n.beginPath(),n.arc(116,128,94,0,7),n.fill(),n.fillStyle=e,n.beginPath(),n.arc(116,128,86,0,7),n.fill(),n.globalCompositeOperation="destination-out",n.beginPath(),n.arc(160,100,74,0,7),n.fill(),n.globalCompositeOperation="source-atop",n.lineWidth=9,n.strokeStyle=Ai,n.beginPath(),n.arc(160,100,78,0,7),n.stroke(),n.fillStyle="rgba(255,255,255,.45)",n.beginPath(),n.ellipse(56,150,9,30,.3,0,7),n.fill(),i.drawImage(t,0,0);for(let[r,a,s]of[[186,92,26],[214,160,15],[160,136,10]]){let o=new Path2D;for(let l=0;l<10;l++){let c=-Math.PI/2+l*Math.PI/5,h=l%2?s*.45:s;l?o.lineTo(r+Math.cos(c)*h,a+Math.sin(c)*h):o.moveTo(r+Math.cos(c)*h,a+Math.sin(c)*h)}o.closePath(),kt(i,o,"#ffd23a",5)}}};Vn.calaveraFuego=(i,e)=>{i.save(),i.translate(0,8),Vn.llamas(i,e),i.restore(),i.save(),i.translate(128,126),i.scale(.72,.72),i.translate(-128,-128),Vn.calavera(i,"#f4ecd8"),i.restore()};Vn.rosaNeon=(i,e)=>{Vn.rosa(i,e);for(let[t,n,r]of[[42,46,16],[214,58,12],[206,170,14],[50,168,10]]){let a=new Path2D;for(let s=0;s<8;s++){let o=s*Math.PI/4,l=s%2?r*.3:r;s?a.lineTo(t+Math.cos(o)*l,n+Math.sin(o)*l):a.moveTo(t+l,n)}a.closePath(),kt(i,a,e,4)}};zv=new Set(["dragon","fenix","mariposaT","lunaT","calaveraFuego","rosaNeon"]),Bf=(i,e)=>Lr("tat"+i+e,()=>ft(256,256,t=>Vn[i](t,Ri(e)))),lf={},Hv=(i,e)=>lf[i+e]||(lf[i+e]=(()=>{let t=new on({map:Bf(i,e),gradientMap:vs,transparent:!0,alphaTest:.03,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4});return zv.has(i)&&(t.onBeforeCompile=n=>{n.uniforms.uLT=mc,n.fragmentShader=`uniform float uLT;
`+n.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
{ vec4 tc = texture2D(map, vMapUv); float w = 0.5 + 0.5 * sin(uLT * 3.0 - vMapUv.y * 9.0); totalEmissiveRadiance += tc.rgb * tc.a * (0.6 + 2.2 * w); }`)},t.customProgramCacheKey=()=>"tatLeg"),t})()),Yh={brazoI:{part:1,s:-.15,a:1.35,R:.066},brazoD:{part:2,s:-.15,a:-1.35,R:.066},antebrazoI:{part:1,s:-.47,a:.8,R:.046},antebrazoD:{part:2,s:-.47,a:-.8,R:.046},pecho:{part:0,s:.43,a:.5,R:.07},espalda:{part:0,s:.38,a:Math.PI,R:.11},cuello:{part:0,s:.676,a:1.35,R:.028},manoI:{part:1,s:-.685,a:1.57,R:.028},manoD:{part:2,s:-.685,a:-1.57,R:.028},clavicula:{part:0,s:.525,a:.45,R:.04},musloI:{part:3,s:-.3,a:1.1,R:.065},musloD:{part:4,s:-.3,a:-1.1,R:.065}};ys=class{constructor(e,t="guitar"){e=_h(e),this.cfg=e,this.kind=t,this.seed=ct()*10;let n=this.fem=e.body==="f",r=this.b={...N1[e.body],...e.build||{}},a=this.F=F1(e.body,e.face||{}),s=e.acc||{},o=e.hair||{style:"bald",color:2236962},l=this.root=new ht;this.base=P(),this.baseYaw=0,this.side=0,this.Lup=rc,this.Lfo=ac,this.Lth=Oh,this.Lsh=rf;let c=Nv[e.shoes?.type],h=c?c[0]:e.shoes?.type||"boot",d=Ov[h]||"boot";this.ankleH=d==="platform"?.165:.09,this.hipRest=.97+(this.ankleH-.09);let u=r.sw,p=r.hip,m=r.waist,g=r.chest,f=(_,A,B,ae)=>{let de=new ts;return de.position.set(A,B,ae),_&&_.add(de),de},y=f(null,0,this.hipRest,0);l.add(y);let x=f(y,0,.06,0),v=f(x,0,.3,0),E=f(v,0,.29,0),S=f(E,0,.09+(r.neck??0),.01),T=f(S,0,.117,-.028),C=[],L=[],I=[],V=[];for(let _ of[1,-1]){let A=f(v,_*u*(r.shX??.95),.2+(r.shY??0),0);C.push(A),L.push(f(A,0,-rc,0));let B=f(y,_*p*.56,-.02,0);I.push(B),V.push(f(B,0,-Oh,0))}let X=this.src=bv(n,r,this.hipRest),N=[],oe=[],F=[];for(let _=0;_<2;_++){let A=X.hand[_],B=f(L[_],0,-ac,0),ae=f(B,0,0,0);F.push(B),N.push(ae);let de=[];for(let ye of A.fingers){let M=ae,z=A.wrist,J=[];for(let fe of ye){let me=f(M,fe.x-z.x,fe.y-z.y,fe.z-z.z);J.push(me),M=me,z=fe}de.push(J)}oe.push(de)}Object.assign(this,{hips:y,spine:x,chest:v,neck:E,head:S,jaw:T,ua:C,fa:L,th:I,sh:V,handB:N,fingB:oe,twB:F}),this.body=y;let ne=this.torso=new ht;ne.position.y=-.3,v.add(ne);let $=this.face=new ht;$.position.y=.135,S.add($),l.updateMatrixWorld(!0),this.skel=new js([y,x,v,E,S,T,C[0],L[0],C[1],L[1],I[0],V[0],I[1],V[1],...[0,1].flatMap(_=>[F[_],N[_],...oe[_].flat()])]),this._I=new Ze;let O=$.getWorldPosition(P());this.auraQ=[];let q=this.M={skin:Ee(e.skin,{gradientMap:vs}),skinD:Ee(ei(e.skin,.8),{gradientMap:vs}),hair:Ee(o.color,{map:We.hairStreak}),hairS:Ee(o.color),hair2:Ee(o.color2||o.color),white:Ee(16315886),iris:Ee(a.eyes||3811864),pupil:new Pt({color:328965}),spec:new Pt({color:16777215}),brow:Ee(a.brow??ei(o.color,.6)),metal:Ee(13225174),gold:Ee(14263866),leather:Ee(1578010),shoe:c?nt(c[1],e.shoes.color??1710618,c[2],{scale:16,side:ni}):Ee(e.shoes?.color??1710618),sole:c?.[1]==="crystal"?nt("crystal",10148095,16777215,{scale:24,side:ni}):Ee(d==="platform"?2365998:d==="sneaker"?15921126:2763306)},se=[],Z=_=>{_&&se.push(..._)};Z(ds[e.top?.type]?.(e.top)),Z(Tr[e.bottom?.type]?.(e.bottom||{})),e.legwear&&Z(sc[e.legwear.type]?.(e.legwear));let te=e.shoes?.color??1710618,Ce=_=>_.part===3||_.part===4,R=c?[c[1],te,c[2],16]:null;if((h==="boot"||h==="chelsea")&&se.push({pred:_=>Ui(_,-.8,-.995),inf:_=>.014+.006*Oe(Se((-_.s-.8)/.12,0,1)),color:te,leg:R}),h==="chelsea"&&se.push({pred:_=>Ui(_,-.83,-.99)&&Math.abs(Math.sin(_.a))>.78,inf:_=>.0168+.006*Oe(Se((-_.s-.8)/.12,0,1)),color:ei(te,.4)}),h==="tallboots"){let _=A=>.011+.008*Oe(Se((A.s+.5)/.08,0,1))+.004*Oe(Se((-A.s-.85)/.1,0,1));se.push({pred:A=>Ui(A,-.42,-.995),inf:_,color:te,leg:R});for(let A of[-.58,-.7,-.82])se.push({clip:B=>Ce(B)?.011-Math.abs(B.s-A):-1,inf:B=>_(B)+.0045,color:ei(te,.45),leg:c?["chrome",13159640,16777215,10]:null})}h==="hightops"&&(se.push({pred:_=>Ui(_,-.82,-.995),inf:_=>.012+.005*Oe(Se((-_.s-.82)/.1,0,1)),color:te}),se.push({clip:_=>Ce(_)?.012-Math.abs(_.s+.832):-1,inf:.0168,color:15921126}));let w=e.gloves?.type&&e.gloves.type!=="none"?e.gloves.type:null,K=e.gloves?.color??1447446,W=_=>_.part===1||_.part===2;(w==="sinDedos"||w==="tachas")&&se.push({pred:_=>W(_)&&_.s<-.618||_.part>=5&&_.t<.42,inf:.0028,color:K}),w==="completos"&&se.push({pred:_=>W(_)&&_.s<-.6||_.part>=5,inf:.0028,color:K}),w==="mitones"&&(se.push({pred:_=>W(_)&&_.s<-.628||_.part>=5&&_.t<.3,inf:.0026,color:K}),se.push({pred:_=>zn(_,-.6,-.638),inf:_=>.009+.0035*Math.cos(_.a*11),color:e.gloves.color2??ei(K,3),sheer:!0})),w==="red"&&se.push({pred:_=>W(_)&&_.s<-.42||_.part>=5,inf:.0022,color:K,map:kf(),sheer:!0}),w==="largos"&&se.push({pred:_=>W(_)&&_.s<-.22||_.part>=5,inf:.003,color:K});let U=_=>W(_)&&_.s<-.6||_.part>=5;w==="tesla"&&se.push({pred:U,inf:.0028,color:K,leg:["electric",K,7002367,30]}),w==="garrasMagma"&&se.push({pred:U,inf:.0028,color:K,leg:["lava",K,16734736,34]}),w==="guanteHolo"&&se.push({pred:_=>W(_)&&_.s<-.22||_.part>=5,inf:.003,color:K,leg:["holo",K,16777215,10]}),w==="estelares"&&(se.push({pred:_=>W(_)&&_.s<-.628||_.part>=5&&_.t<.3,inf:.0026,color:K,leg:["galaxy",K,2808063,22]}),se.push({pred:_=>zn(_,-.6,-.638),inf:_=>.009+.0035*Math.cos(_.a*11),color:K,sheer:!0,leg:["neon",16743112,4905215,30]})),w==="cosmicos"&&se.push({pred:U,inf:.0028,color:K,leg:["galaxy",K,3856639,26]}),w==="guantesCristal"&&se.push({pred:_=>W(_)&&_.s<-.22||_.part>=5,inf:.003,color:K,leg:["crystal",K,16777215,12]}),s.warmers&&se.push({pred:_=>zn(_,-.36,-.625),inf:.006,color:16777215,map:Tf(s.warmers[0],s.warmers[1],8,[1,6])});let re=_=>se.some(A=>!A.sheer&&(A.clip?A.clip(_)>.03:A.pred(_)));for(let _ of se){let A={side:Vt};_.map&&(A.map=_.map),_.sheer&&(A.alphaTest=.35);let B=_.leg?nt(_.leg[0],_.leg[1]??_.color,_.leg[2],{scale:_.leg[3]??8,map:_.map,alphaTest:_.sheer?.35:0}):Ee(_.color,A),ae=de=>n&&!_.leg?yv(de,this.hipRest+.06,r.bust??1):de;_.clip?this.skin(hn(X,de=>_.clip(de)>-.045,_.inf,!1,_.clip).geo,ae(sa(B)),.007):this.skin(hn(X,_.pred,_.inf).geo,ae(B),_.sheer?0:.007)}let k=this.hsrc=wv(n,a,e,O),H=Lv(e.skin,k);this.neckU=H.U,H.U.uSp.value=this.hipRest+.06,H.U.uBust.value=n?r.bust??1:0,this.skin(hn(X,_=>!re(_),0,!0).geo,H.mat,.009);let ie=Pv(n,a,e,k);this.faceU=ie.U,this.gaze=[P(),P()],this.skin(k.geo,ie.mat,.008);for(let _ of e.tattoos||[]){let A=Yh[_.spot];A&&Vn[_.design]&&this.skin(zf(X,A),Hv(_.design,_.color??1709088),0)}this.tatMk={};for(let[_,A]of Object.entries(Yh)){let B=A.part-1,ae=A.part===0?A.s>.6?E:v:A.part<=2?A.s>-.33?C[B]:A.s>-.62?L[B]:N[B]:I[A.part-3],de=new vt;de.position.copy(ae.worldToLocal(Of(X,A).c)),ae.add(de),this.tatMk[_]=de}let ge=e.beard?.type,pe=Nf[ge],b=pe?"full":ge,Q=pe?nt(pe[0],e.beard.color??16730640,pe[1],{scale:pe[2],map:We.hairStreak,mat:{polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-2}}):Ee(ei(e.beard?.color??o.color,1.35),{map:We.hairStreak,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),G=(_,A,B)=>this.skin(hn(k,ae=>_(ae)>-.006,ae=>A(ae)*(.45+.55*Oe(Se(_(ae)/.007,0,1))),!1,_).geo,sa(Q),B),Y=_=>{let A=Math.abs(_.X)/k.mw,B=k.vm+.004-.007*Oe(Se((A-.65)/.45,0,1)),ae=k.tY-.008-.007*A*A;return Math.min((_.nz-.4)*.05,k.mw+.005-Math.abs(_.X),_.Y-B,ae-_.Y)};if(b==="goatee"&&(G(_=>Math.min((_.nz-.35)*.05,.021-.005*Oe(Se((k.vm-.03-_.Y)/.05,0,1))-Math.abs(_.X),k.vm-.009-_.Y,_.Y+.14),_=>.004+.007*Oe(Se((k.vm-.02-_.Y)/.04,0,1)),.004),G(Y,()=>.0035,.003)),b==="mustache"&&G(Y,()=>.004,.003),b==="full"){let _=A=>(Math.hypot(A.X/k.mw,(A.Y-k.vm+.001)/.0088)-1)*.009;G(A=>Math.min((A.nz+.15)*.05,Df(k,Math.abs(A.X))+.0016*Math.sin(Math.abs(A.X)*950)-A.Y,(A.ny+.92)*.05,_(A)),A=>.005+.011*Oe(Se((-.05-A.Y)/.07,0,1)),.005)}if(ge==="barbaFuego"&&this.auraQ.push({kind:pe[0],cols:[e.beard.color??16730640],a:e.beard.color??16730640,b:16764992}),ge==="escarcha"){let _=nt("crystal",e.beard.color??9097471,16777215,{scale:60,side:ni}),A=nt("neon",7002367,16777215,{scale:90}),B=k.frontZ(.016,-.11);for(let ae of[-1,1])for(let de=0;de<6;de++){let ye=ae*.016,M=-.13-de*.017,z=B-.004-de*.003;he(this.jaw,Pe("braid",()=>new bt(.0105,10,8).scale(1,1.3,.85)),_,{pos:[ye+ae*.002*(de%2?1:-1),M+.018,z+.028],rot:[0,0,de%2?.35:-.35],outline:.0015}),(de===2||de===5)&&he(this.jaw,Pe("bring",()=>new wt(.0105,.0028,6,16).rotateX(Math.PI/2)),A,{pos:[ye,M+.012,z+.028],outline:0})}}for(let _ of[-1,1]){let A=_*.112;he($,Pe("ear",()=>new bt(.027,14,10).scale(.36,1,.7)),q.skin,{pos:[A,-.004,-.012],rot:[0,_*-.35,0],outline:.004}),he($,Pe("earIn",()=>new bt(.016,10,8).scale(.3,1,.6)),q.skinD,{pos:[A+_*.004,-.004,-.008],rot:[0,_*-.35,0],outline:0});let B=e.earrings?.type,ae=Ee(e.earrings?.color??13225174),de=[A+_*.003,-.031,-.004],ye=()=>he($,Pe("echain",()=>new Ke(9e-4,9e-4,.016,4)),ae,{pos:[A+_*.004,-.039,-.004],outline:0});B==="argolla"&&_<0&&he($,Pe("ering",()=>new wt(.011,.0025,6,14)),ae,{pos:de,rot:[0,Math.PI/2,0],outline:0}),B==="arete"&&he($,Pe("estud",()=>new ta(.0045,0)),ae,{pos:[A+_*.004,-.027,-.002],outline:.001}),B==="cruz"&&_<0&&(he($,Pe("ering2",()=>new wt(.006,.0015,5,10)),ae,{pos:de,rot:[0,Math.PI/2,0],outline:0}),he($,Pe("cross",()=>ao([new Xe(.0035,.026,.0035),new Xe(.0035,.0035,.015).translate(0,.004,0)])),ae,{pos:[de[0],-.051,de[2]],outline:.0012})),B==="aros"&&he($,Pe("hoopF",()=>new wt(.021,.0018,6,28)),ae,{pos:[A+_*.005,-.051,-.004],rot:[0,Math.PI/2,0],outline:.001}),B==="estrellas"&&(ye(),he($,Pe("estar",()=>new ri(ua(0,0,.011,.0048),{depth:.002,bevelEnabled:!1}).translate(0,0,-.001).rotateY(Math.PI/2)),ae,{pos:[A+_*.005,-.056,-.004],outline:.001}));let M=(z,J,fe=160)=>nt(z,e.earrings?.color??16777215,J,{scale:fe,side:ni});B==="gemaSangre"&&(he($,Pe("egem",()=>new rs(.0072,0).scale(1,1.25,.75)),M("crystal",16765144),{pos:[A+_*.005,-.03,-.002],outline:.001}),he($,Pe("egemS",()=>new wt(.0078,.0012,5,14)),M("chrome",16777215,300),{pos:[A+_*.0045,-.03,-.002],rot:[0,Math.PI/2,0],outline:0})),B==="rayoArete"&&_<0&&(he($,Pe("ering2",()=>new wt(.006,.0015,5,10)),M("chrome",16777215,300),{pos:de,rot:[0,Math.PI/2,0],outline:0}),he($,Pe("ebolt",()=>new ri(Jp(.034),{depth:.003,bevelEnabled:!1}).translate(0,0,-.0015).rotateY(Math.PI/2)),M("electric",16777215,200),{pos:[de[0]+_*.001,-.054,de[2]],outline:.001})),B==="fugaces"&&(ye(),he($,Pe("estarL",()=>new ri(ua(0,0,.014,.006),{depth:.003,bevelEnabled:!1}).translate(0,0,-.0015).rotateY(Math.PI/2)),M("glitter",16777215),{pos:[A+_*.005,-.06,-.004],outline:.001}),he($,Pe("estarS",()=>new ri(ua(0,0,.007,.003),{depth:.002,bevelEnabled:!1}).translate(0,0,-.001).rotateY(Math.PI/2)),M("glitter",16777215),{pos:[A+_*.006,-.078,-.012],outline:.001})),B==="gotasDiamante"&&(he($,Pe("echainL",()=>new Ke(9e-4,9e-4,.028,4)),M("chrome",16777215,300),{pos:[A+_*.004,-.045,-.004],outline:0}),he($,Pe("dropL",()=>new rs(.0085,1).translate(0,-.004,0).scale(1,1.9,1)),M("crystal",16777215,200),{pos:[A+_*.005,-.066,-.004],outline:.001})),B==="cruzFuego"&&(he($,Pe("ering2",()=>new wt(.006,.0015,5,10)),M("chrome",16777215,300),{pos:de,rot:[0,Math.PI/2,0],outline:0}),he($,Pe("crossL",()=>ao([new Xe(.0042,.03,.0042),new Xe(.0042,.0042,.018).translate(0,.005,0)])),nt("fire",e.earrings?.color??1705989,16769120,{scale:200,side:ni}),{pos:[de[0],-.054,de[2]],outline:.0012})),B==="corazonesNeon"&&(ye(),he($,Pe("eheartN",()=>new ri(Yl(.012),{depth:.003,bevelEnabled:!1}).translate(0,0,-.0015).rotateY(Math.PI/2)),M("neon",16777215,200),{pos:[A+_*.005,-.058,-.004],outline:.001})),B==="gotas"&&(ye(),he($,Pe("drop",()=>new bt(.006,10,8).translate(0,-.004,0).scale(1,1.6,1)),ae,{pos:[A+_*.005,-.048,-.004],outline:.001}))}let ce=this.hair=new ht;$.add(ce),this.tails=[];let xe=Bv[o.style],we=xe?xe.base:o.style,_e=(_=0)=>A=>.0045+.009*Math.max(0,A.ny)**1.5+_,Ae=(_,A=0,B)=>{let ae=de=>de.ny-sf(de.ph,B);this.skin(hn(k,de=>ae(de)>-.06,_e(A),!1,ae).geo,sa(_),.008)},be=Ee(o.color,{flatShading:!0}),Te=Ee(o.color2||o.color,{flatShading:!0}),Ie=Ee(ei(o.color,.8),{flatShading:!0});if(xe){let _=o.color,A=o.color2??_,B={scale:xe.sc,k:xe.k??1,flat:!0,side:ni};be=nt(xe.fx,_,A,B),Te=nt(xe.fx,A,_,B),Ie=nt(xe.fx,ei(_,.7),A,B),q.hair=nt(xe.fx,_,A,{scale:xe.sc,k:xe.k??1,map:We.hairStreak,side:ni})}let ee=[be,Te,be,Ie],le=(_,A,B,ae,de,ye={})=>he(_,jp(A,B,ae,ye.th??.0095,ye),de,{outline:ye.ol??.0042});this.chains=[];let ue=(_,A,B,ae,de,ye={})=>{let M=ye.n??4,z=ye.segs??14,J=jp(A,B,ae,ye.th??.0095,{...ye,segs:z}),fe=new wi(A),me=[];for(let je=0;je<=M;je++)me.push(fe.getPointAt(je/M));let De=J.attributes.position.count,Le=new Uint16Array(De*4),Fe=new Float32Array(De*4);for(let je=0;je<De;je++){let st=je<(z+1)*6?Math.floor(je/6)/z:je===De-2?0:1,Jt=st*M,Ht=Se(Math.floor(Jt-.5),0,M-1),et=Math.min(Ht+1,M-1),rt=et===Ht?0:Se(Jt-.5-Ht,0,1);Le[je*4]=Ht,Fe[je*4]=1-rt,Le[je*4+1]=et,Fe[je*4+1]=rt}J.setAttribute("skinIndex",new rr(Le,4)),J.setAttribute("skinWeight",new He(Fe,4));let qe=[];for(let je=0;je<M;je++){let st=new ts;st.position.copy(je?me[je].clone().sub(me[je-1]):me[0]),(je?qe[je-1]:_).add(st),qe.push(st)}let tt=new vr(J,de),it=new vr(J,hc(ye.ol??.0042));tt.frustumCulled=it.frustumCulled=!1,_.add(tt,it),this.chains.push({par:_,bones:qe,J:me,meshes:[tt,it],stiff:ye.stiff??10,W:me.map(()=>P()),P:null,Pp:null})},Me=(_,A,B=1)=>P(Math.sin(_)*Math.cos(A)*.122*B,Math.sin(A)*.15*B,Math.cos(_)*Math.cos(A)*(Math.cos(_)>0?.13:.142)*B),ze=(_,A,B)=>P(Math.sin(_)*.128*B,A,Math.cos(_)*(Math.cos(_)>0?.13:.145)*B),Je=xo(Math.floor(this.seed*1e3)),Ye=(_,A)=>Ue(_,A,Je()),Ot=()=>{for(let _=-4;_<=4;_++){let A=_*.0172,B=.061+(_&1?.005:0)+Ye(-.002,.002)+Math.abs(_)*.0012,ae=_&1?0:.004,de=(ye,M,z)=>k.frontZ(ye,M)+z+ae;le(ce,[P(A*.5,.155,.03),P(A*.8,.14,de(A*.8,.14,.018)),P(A*.95,.105,de(A*.95,.105,.015)),P(A,B,de(A,B,.011))],.025,.023,ee[(_+4)%4],{tip:"blunt",th:.011})}},xt=()=>{for(let _ of[-1,1])for(let A=0;A<2;A++)ue(ce,[P(_*.06,.148,.07),P(_*.108,.09,.09-A*.01),P(_*(.126+A*.01),0,.072-A*.015),P(_*(.128+A*.01),-.08,.055-A*.018),P(_*(.122+A*.012),-.135-A*.025,.042-A*.02)],.046,.034,ee[A*2+1],{n:3,stiff:18})};if(we==="long"){Ae(q.hair);for(let _=0;_<18;_++){let A=Ue(1.2,Math.PI*2-1.2,_/17)+Ye(-.05,.05),B=Ye(.4,.5);ue(ce,[Me(A,.7,1),Me(A,.2,1.1),ze(A,-.08,1.13),ze(A,-.22,1.17),ze(A,-B,1.12).add(P(0,0,-.03))],.056,.042,ee[_%4],{n:5,stiff:14})}for(let _=0;_<13;_++){let A=Ue(1,Math.PI*2-1,_/12)+Ye(-.05,.05),B=Ye(.28,.4);ue(ce,[Me(A,1.3,1.02),Me(A,.6,1.13),Me(A,0,1.22),ze(A,-.14,1.22),ze(A,-B,1.2).add(P(0,0,-.02))],.062,.046,ee[(_+1)%4],{n:5,stiff:15})}for(let _ of[-1,1])le(ce,[P(_*.004,.16,-.01),P(_*.01,.152,.06),P(_*.035,.122,.112),P(_*.075,.08,.124),P(_*.112,.02,.108)],.045,.034,Te);for(let _ of[-1,1])for(let A=0;A<3;A++)ue(ce,[P(_*.006,.152,.045),P(_*(.05+A*.013),.14,.095-A*.012),P(_*(.098+A*.01),.075,.104-A*.014),P(_*(.122+A*.007),-.04,.084-A*.014),P(_*(.13+A*.007),-.17-A*.05,.055-A*.012)],.042,.03,ee[A+1],{n:4,stiff:16})}else if(we==="pigtails"||we==="bob"||we==="odango"||we==="longF"){if(Ae(q.hair,.003),Ot(),xt(),we==="longF"){for(let _=0;_<18;_++){let A=Ue(1.25,Math.PI*2-1.25,_/17)+Ye(-.04,.04),B=Ye(.46,.56);ue(ce,[Me(A,.7,1),Me(A,.2,1.1),ze(A,-.08,1.13),ze(A,-.24,1.15),ze(A,-B,1.1).add(P(0,0,-.02))],.056,.04,ee[_%4],{n:5,stiff:13})}for(let _=0;_<12;_++){let A=Ue(1.15,Math.PI*2-1.15,_/11)+Ye(-.04,.04),B=Ye(.3,.42);ue(ce,[Me(A,1.25,1.02),Me(A,.55,1.13),Me(A,0,1.2),ze(A,-.14,1.2),ze(A,-B,1.17).add(P(0,0,-.015))],.06,.044,ee[(_+1)%4],{n:5,stiff:14})}for(let _ of[-1,1])for(let A=0;A<2;A++)ue(ce,[P(_*(.09+A*.012),.11,.092-A*.012),P(_*(.126+A*.01),0,.078-A*.012),P(_*(.138+A*.01),-.12,.07-A*.012),P(_*(.145+A*.012),-.23-A*.03,.075-A*.015)],.042,.03,ee[A+1],{n:4,stiff:15})}else{let _=we==="bob"?.16:we==="odango"?.075:.1;for(let A=0;A<14;A++){let B=Ue(1.25,Math.PI*2-1.25,A/13);le(ce,[Me(B,.9,1.02),Me(B,.3,1.12),ze(B,-.03,1.16),ze(B,-_-Ye(0,.015),1.13)],.058,.05,ee[A%4],{tip:we==="bob"?"blunt":"point"})}}if(we==="odango")for(let _ of[-1,1]){let A=new ht;A.position.set(_*.08,.142,-.03),A.rotation.z=-_*.5,ce.add(A),he(A,Pe("bun",()=>new ta(.052,1).scale(1,.9,1)),be,{outline:.005});for(let B=0;B<6;B++){let ae=B/6*Math.PI*2,de=[];for(let ye=0;ye<5;ye++){let M=ae+ye*.75,z=1.25-ye*.5;de.push(P(Math.cos(z)*Math.cos(M)*.056,Math.sin(z)*.056,Math.cos(z)*Math.sin(M)*.056))}le(A,de,.03,.02,ee[B%4],{ctr:P(0,0,0),th:.008,ol:.003})}he(A,Pe("bunRing",()=>new wt(.034,.0075,6,20).rotateX(Math.PI/2)),Ee(o.accent??16730778),{pos:[0,-.034,0],outline:.003});for(let B=0;B<3;B++)ue(A,[P((B-1)*.012,-.03,-.02),P((B-1)*.02,-.08,-.04),P((B-1)*.025,-.16,-.035),P((B-1)*.03,-.24-B*.02,-.02)],.032,.024,ee[(B+1)%4],{ctr:P(0,-.1,.1),n:4,stiff:10});A.userData={s:_,k:.12},this.tails.push(A)}if(we==="pigtails")for(let _ of[-1,1]){let A=new ht;A.position.set(_*.085,.1,-.03),ce.add(A),he(A,Pe("bauble",()=>new bt(.038,14,10)),xe?nt("glitter",16777215,o.color2??16777215,{side:ni}):Ee(o.accent??16751130),{outline:.005});for(let B=0;B<6;B++){let ae=P(Ye(-.02,.02),0,Ye(-.025,.025)),de=.5+B*.02+Ye(0,.04);ue(A,[P(0,.01,0),P(_*.05,.02,-.03).add(ae),P(_*.1,-.06,-.04).add(ae),P(_*.13+ae.x,-.2,-.03+ae.z),P(_*.135+ae.x,-.36,0+ae.z),P(_*.125+ae.x,-de,.02)],.05,.038,ee[B%4],{ctr:P(-_*.05,.05,0),th:.011,n:5,segs:18,stiff:9+B*.6})}for(let B of[-.25,.25])he(A,uo([P(0,0,.02),P(_*.03,-.06,.04),P(_*(.04+B*.1),-.16,.05),P(_*(.03+B*.15),-.26,.04)],.006,.004,10,4,.3),xe?nt("neon",o.color2??3856639,o.color,{scale:60}):Ee(o.ribbon??4380234),{outline:0});A.userData={s:_,k:.35},this.tails.push(A)}}else if(we==="ponytail"){Ae(q.hair,.002),Ot();for(let A of[-1,1])le(ce,[P(A*.04,.148,.09),P(A*.1,.09,.098),P(A*.124,0,.075),P(A*.122,-.09,.05)],.036,.026,Te);let _=new ht;_.position.set(0,.085,-.135),ce.add(_),he(_,Pe("tie",()=>new wt(.022,.008,6,14)),Ee(o.accent??2236962),{rot:[.6,0,0],outline:.003});for(let A=0;A<7;A++){let B=P(Ye(-.025,.025),0,Ye(-.015,.015));ue(_,[P(0,0,0),P(B.x,.02,-.05),P(B.x*1.5,-.08,-.09+B.z),P(B.x*2,-.25,-.08+B.z),P(B.x*2,-.38-A*.015,-.05)],.045,.034,ee[A%4],{ctr:P(0,-.1,.1),n:4,stiff:9+A*.5})}this.tails.push(_)}else if(we==="mohawk"){{let B=ae=>ae.ny-sf(ae.ph);this.skin(hn(k,ae=>B(ae)>-.06,.0025,!1,B).geo,sa(q.skinD),.006)}let _=o.style==="trueno",A=_?11:9;for(let B=0;B<A;B++){let ae=Ue(.8,-1.55,B/(A-1)),de=_?.17+Math.sin(B/(A-1)*Math.PI)*.2:.13+Math.sin(B/8*Math.PI)*.12,ye=P(0,Math.cos(ae)*.148,Math.sin(ae)*.148),M=P(0,Math.cos(ae-.4),Math.sin(ae-.4));le(ce,[ye.clone().addScaledVector(M,-.02),ye.clone().addScaledVector(M,de*.45),ye.clone().addScaledVector(M,de)],_?.075:.06,_?.045:.04,ee[B%4],{nrm:P(1,0,0),th:_?.013:.01})}}else if(we==="spiky"){Ae(q.hair,.004);for(let _=0;_<20;_++){let A=Je()*Math.PI*2,B=Ye(.15,1.05),ae=P(Math.sin(A)*Math.sin(B),Math.cos(B),Math.cos(A)*Math.sin(B)*.9-.15).normalize(),de=ae.clone().multiply(P(.11,.14,.12));le(ce,[de.clone().addScaledVector(ae,-.01),de.clone().addScaledVector(ae,.05),de.clone().addScaledVector(ae,Ye(.09,.14)).add(P(0,.02,0))],.05,.035,ee[_%4],{nrm:P().crossVectors(ae,P(.3,.2,1)).normalize(),th:.012})}}else if(we==="furia"){Ae(q.hair,.004);let _=(A,B,ae,de,ye)=>{let M=P(B.z,0,-B.x);M.lengthSq()<1e-6&&M.set(1,0,0),M.normalize(),le(ce,[A.clone().addScaledVector(B,-.015),A.clone().addScaledVector(B,ae*.5),A.clone().addScaledVector(B,ae)],de,de*.6,ye,{nrm:P().crossVectors(M,B).normalize(),th:.016})};for(let A=0;A<30;A++){let B=A/30*Math.PI*2+Ye(-.08,.08),ae=A%3===0?Ye(1.05,1.35):Ye(.45,1),de=Me(B,ae,.96),ye=de.clone().normalize(),M=Math.cos(B)>.5,z=M?ye.clone().multiplyScalar(.35).add(P(0,1,.05)).normalize():ye.clone().multiplyScalar(.55).add(P(0,1,-.32)).normalize();_(de,z,(M?.13:.18)+Ye(0,.12)*(ae>1?1.4:1),M?.055:.07,ee[A%4])}for(let A of[-1,1])_(Me(A*.2,1.05,.98),P(A*.25,-.75,.62).normalize(),.14,.04,Te)}else if(we==="short"){Ae(q.hair,.004);for(let _=0;_<16;_++){let A=Ue(-2.6,2.6,_/15)+Ye(-.08,.08),B=Ye(1.1,1.35);le(ce,[Me(A*.25,B,1),Me(A*.6,B-.3,1.1),Me(A,B-.75,1.12)],.05,.038,ee[_%4],{th:.011})}}xe&&this.auraQ.push({kind:xe.fx,cols:[o.color,o.color2??o.color,ei(o.color,.7)],a:o.color,b:o.color2??o.color,bolt:xe.aura==="bolt"}),s.sweatband&&he($,Pe("sband",()=>new wt(.128,.016,8,30).scale(.93,1,1.04).rotateX(Math.PI/2-.3)),Ee(16777215),{pos:[0,.078,-.008],outline:.004});let Dt=(_,A,B,ae,de,ye,M=0)=>{let[,z,J,fe]=X.torsoAt(_),me=[];for(let De=0;De<28;De++){let Le=De/28*Math.PI*2,Fe=Math.sin(Le),qe=Math.cos(Le);me.push(P((z+A)*Fe,ye+Fe*M,((qe>0?z*J:z*fe)+A)*qe))}return he(de,new wn(new wi(me,!0),56,B,6,!0),ae,{outline:.003})},ve=kv[e.bottom?.type],Cn=!!ve,Fi=Cn?.028:.016,Nt=Cn?.07:.06;if(e.belt&&e.bottom?.type!=="shorts"){let A=Cn?.03:.022,B=ae=>ae.part===0?.017-Math.abs(ae.s-Nt):-1;this.skin(hn(X,ae=>B(ae)>-.04,A,!1,B).geo,sa(Ee(e.belt,{side:Vt})),.004),he(y,Pe("buckle",()=>new Xe(.046,.036,.008)),q.metal,{pos:[0,Nt+.06,X.frontZ(Nt)+A+.004],outline:.003})}if(s.bulletBelt){let[,_,A,B]=X.torsoAt(-.03),ae=new Ar,de=new Ke(.008,.008,.045,6),ye=new Qt(.008,.016,6);Dt(-.03,.024,.016,q.leather,y,.03,.05);for(let M=0;M<15;M++){let z=(M/14-.5)*2.2,J=Math.sin(z),fe=Math.cos(z),me=(_+.03)*J,De=(_*A+.03)*fe,Le=.03+J*.05;ae.add(q.gold,de,[me,Le,De],[0,-z,.35]),ae.add(q.metal,ye,[me-.008,Le+.03,De],[0,-z,.35])}ae.build(y)}if(s.chain){let _=X.frontZ(.04)+.02;he(y,uo([P(-.06,.1,_),P(-p*.95,-.02,_*.6),P(-p*1.15,-.07,0),P(-p*.95,.05,-X.backZ(0)-.01)],.005,.005,20,5),q.metal,{outline:.002})}if(ve){let _=new vo,A=14,B=64,ae=.075,de=ve.HL;_.grid(A+1,B,(M,z)=>{let J=M/A,fe=ae-de*J,me=z/B*Math.PI*2,[De,Le]=X.surfAt(Math.max(fe,-.07),me),Fe=Math.hypot(De,Le)||1,qe=Oe(Se((-.04-fe)/.2,0,1)),tt=Fe+.016+ve.flare*qe,it=1+ve.pleat*Math.max(0,Math.cos(me*16))*qe,je=De/Fe*tt*it,st=Le/Fe*tt*it,Jt=.8*Oe(Se((-.04-fe)/.24,0,1)),Ht=Oe(Se(.5+je/.16,0,1)),et=new Map;for(let[rt,At]of Pf(fe,je,0,u))et.set(rt,(et.get(rt)||0)+At*(1-Jt));et.set(fa[0],(et.get(fa[0])||0)+Jt*Ht),et.set(fa[1],(et.get(fa[1])||0)+Jt*(1-Ht)),_.vert(je,this.hipRest+.06+fe,st,z/B,J,[...et],{t:J})});let ye=this.skin(_.build().geo,ve.leg?nt(ve.leg[0],e.bottom.color??6957752,ve.leg[1],{scale:ve.leg[2]}):ve.plaid?Ee(16777215,{side:Vt,map:Uf(e.bottom.color??11740202,[8,2])}):Ee(e.bottom.color??1447446,{side:Vt}),.008);ye.castShadow=!0}if(e.bottom?.rips||e.bottom?.type==="jeansRips")for(let _ of[0,1])he(I[_],Pe("rip",()=>new bt(.03,10,8).scale(1,.6,.35)),q.skin,{pos:[_?-.01:.01,-.43,.074],outline:.003});if(e.legwear?.type==="stockings")for(let _ of[0,1])he(I[_],Pe("ruffle",()=>new wt(.09,.012,6,24).rotateX(Math.PI/2)),Ee(e.legwear.ruffle??e.legwear.color??9105514),{pos:[0,-.165,.004],scale:[.95,1,.95],outline:.003});let Gi=e.top?.type;if(Gi==="leather"||Gi==="infernal"){let _=B=>X.frontZ(B)+.017,A=Gi==="infernal"?nt("lava",e.top.color??1707016,16734736,{scale:12}):null;for(let B of[-1,1])he(ne,Pe("lapel",()=>new Xe(.05,.24,.012)),A??Ee(ei(e.top.color,1.3)),{pos:[B*.08,.43,_(.43)-.004],rot:[-.1,B*.25,B*.32],outline:.004});if(he(ne,Pe("lcollar"+u,()=>new Ke(.085,.13,.1,18,1,!0,Math.PI*.35,Math.PI*1.3)),A??Ee(ei(e.top.color,1.3),{side:Vt}),{pos:[0,.62,-.01],outline:.004}),s.studs)for(let B of[-1,1])for(let ae=0;ae<4;ae++)he(ne,Pe("stud",()=>new Qt(.009,.02,6)),q.metal,{pos:[B*(u*.86+ae*.016),.59-ae*.004,-.03+ae*.02],rot:[0,0,-B*.4],outline:0})}if(Gi==="cromo"){let _=nt("chrome",e.top.color??9081510,16777215,{scale:12}),A=nt("chrome",14212326,10152191,{scale:30,side:ni});for(let B=0;B<2;B++){let ae=B?-1:1,de=new ht;de.position.set(ae*.012,.012,0),de.rotation.z=-ae*.42,C[B].add(de),he(de,Pe("pauld",()=>new bt(.085,18,10,0,Math.PI*2,0,Math.PI*.5).scale(1,.62,1.08)),_,{outline:.004}),he(de,Pe("pauld2",()=>new bt(.07,16,8,0,Math.PI*2,0,Math.PI*.5).scale(1,.62,1.08)),_,{pos:[ae*.012,-.03,0],outline:.003});for(let ye=0;ye<3;ye++)he(de,Pe("pspike",()=>new Qt(.012,.05,6)),A,{pos:[0,.05,(ye-1)*.04],rot:[(ye-1)*.35,0,0],outline:.002})}}if((Gi==="jacket"||Gi==="chaquetaNeon")&&e.top.accent){let _=Gi==="chaquetaNeon"?nt("neon",e.top.accent,16777215,{scale:30,side:Vt}):Ee(e.top.accent,{side:Vt}),A=n?.638:.628,B=Le=>{let Fe=Math.max(0,Math.cos(Le)),qe=Math.abs(Le);return(n?.606:.582)-.064*Fe*(.4+.6*Oe(Se(qe/.34,0,1)))*(1-Oe(Se((qe-.45)/1,0,1)))},ae=Le=>Le.part===0?Math.min(Le.s-B(Le.a),A-Le.s):-1;this.skin(hn(X,Le=>ae(Le)>-.03,Le=>.019+.004*Oe(Se(1-(Le.s-B(Le.a))/.03,0,1)),!1,ae).geo,sa(_),.004);let de=Ee(e.top.bow??1708080),ye=X.frontZ(.53)+.02;he(ne,Pe("knot",()=>new bt(.012,8,6)),de,{pos:[0,.53,ye],outline:.003});for(let Le of[-1,1])he(ne,Pe("ribbon",()=>new Xe(.012,.07,.005)),de,{pos:[Le*.011,.49,ye-.004],rot:[-.15,0,Le*.3],outline:.002});for(let Le=0;Le<3;Le++){let Fe=.3-Le*.09;he(ne,Pe("button",()=>new bt(.0085,8,6)),Ee(e.top.buttons??16743112),{pos:[0,Fe,X.frontZ(Fe)+.015],outline:.002})}let M=Math.min(...X.meta.filter(Le=>Le.part===1&&Le.s>=-.607&&Le.s<=-.56).map(Le=>Le.s)),z=Le=>{let Fe=Oe(Se((-Le.s-.49)/(-.49-M),0,1));return .024+.017*Fe+.004*Fe*Math.cos(Le.a*9)};this.skin(hn(X,Le=>zn(Le,-.49,M),z).geo,_,.004),this.skin(hn(X,Le=>zn(Le,-.53,M),Le=>z(Le)-.006).geo,Ee(ei(e.top.accent,.82),{side:Vt}),0);let J=X.geo.attributes.position,fe=X.geo.attributes.normal,me=X.geo.attributes.skinIndex,De=X.geo.attributes.skinWeight;for(let Le of[1,2]){let Fe=[];X.meta.forEach((et,rt)=>{et.part===Le&&et.s===M&&!Fe.some(At=>Math.abs(X.meta[At].a-et.a)<1e-4)&&Fe.push(rt)}),Fe.sort((et,rt)=>X.meta[et].a-X.meta[rt].a);let qe=[],tt=[],it=[],je=[],st=6,Jt=Fe.length;for(let et of Fe){let rt=z(X.meta[et])-.002,At=P(J.getX(et),J.getY(et),J.getZ(et)).addScaledVector(P(fe.getX(et),fe.getY(et),fe.getZ(et)),rt),yi=P(fe.getX(et),0,fe.getZ(et)).normalize();for(let Kt=0;Kt<st;Kt++){let at=Kt/st*Math.PI*2;qe.push(At.x+yi.x*Math.cos(at)*.0055,At.y+Math.sin(at)*.0055,At.z+yi.z*Math.cos(at)*.0055),tt.push(me.getX(et),me.getY(et),me.getZ(et),me.getW(et)),it.push(De.getX(et),De.getY(et),De.getZ(et),De.getW(et))}}for(let et=0;et<Jt;et++)for(let rt=0;rt<st;rt++){let At=(et+1)%Jt,yi=et*st+rt,Kt=et*st+(rt+1)%st,at=At*st+rt,gt=At*st+(rt+1)%st;je.push(yi,at,Kt,Kt,at,gt)}let Ht=new ut;Ht.setAttribute("position",new He(qe,3)),Ht.setAttribute("skinIndex",new rr(tt,4)),Ht.setAttribute("skinWeight",new He(it,4)),Ht.setIndex(je),Ht.computeVertexNormals(),this.skin(Ht,_,.003)}}let mt=e.necklace?.type&&e.necklace.type!=="none"?e.necklace.type:null,qn=Ee(e.necklace?.color??13225174),_s=(_,A)=>{let B=.5,ae=.66;for(let de=0;de<18;de++){let ye=(B+ae)/2;Math.hypot(...X.surfAt(ye,_))>A?B=ye:ae=ye}return(B+ae)/2},ya=_=>{let A=.8695652173913044,B=ye=>Ue(_s(ye,.088),_,Math.max(0,Math.cos(ye))**1.6),ae=[],de=ye=>{let M=_s(ye,.088),z=B(ye),J=X.surfAt(M,ye)[0];if(Math.cos(ye)<=0)return[J,z,X.surfAt(z,ye)[1]];let fe=X.torsoAt(z)[1],me=Math.sign(J)*Math.min(1,(Math.abs(J)/fe)**(1/A)),[De,Le]=X.surfAt(z,Math.asin(me));return[De,z,Le]};for(let ye=0;ye<48;ye++){let[M,z,J]=de(ye/48*Math.PI*2),fe=Math.hypot(M,J)||1;ae.push(P(M/fe*(fe+.007),z,J/fe*(fe+.007)))}return{pts:ae,py:B(0)}},Ir=(_,A,B)=>{let[ae,de]=X.surfAt(_,A),ye=Math.hypot(ae,de)||1;return P(ae/ye*(ye+B),_-.59,de/ye*(ye+B))};if(mt==="colmillo"||mt==="placas"||mt==="corazon"){let{pts:_,py:A}=ya(mt==="corazon"?.53:.515),B=ae=>X.frontZ(ae)+.011;if(he(ne,new wn(new wi(_,!0),140,mt==="placas"?.0019:.0026,5,!0),qn,{outline:.0012}),he(ne,Pe("loop",()=>new wt(.0055,.0016,5,12)),qn,{pos:[0,A-.006,B(A)],outline:0}),mt==="colmillo"&&he(ne,Pe("pend2",()=>new Qt(.011,.034,4).rotateY(Math.PI/4).scale(1,1,.35)),Ee(e.necklace.pendant??15787724),{pos:[0,A-.024,B(A-.024)],rot:[-.12,0,Math.PI],outline:.0018}),mt==="placas")for(let ae of[0,1])he(ne,Pe("tag",()=>new Xe(.02,.033,.0025)),Ee(e.necklace.pendant??13817310),{pos:[ae*.009-.004,A-.025-ae*.006,B(A-.025)+.002+ae*.002],rot:[-.1,0,ae*.3-.12],outline:.0015});mt==="corazon"&&he(ne,Pe("hpend",()=>new ri(Yl(.016),{depth:.004,bevelEnabled:!0,bevelSize:.002,bevelThickness:.002,bevelSegments:2})),Ee(e.necklace.pendant??16730778),{pos:[0,A-.026,B(A-.026)],rot:[-.12,0,0],outline:.0015})}if(mt==="perlas"){let _=new wi(ya(.545).pts,!0),A=new Ar,B=new bt(.0062,8,6),ae=Math.floor(_.getLength()/.0126);for(let de=0;de<ae;de++){let ye=_.getPointAt(de/ae);A.add(qn,B,[ye.x,ye.y,ye.z])}A.build(ne)}if(["colmilloFuego","amuleto","corazonCristal","lunaCollar","calaveraCr","mariposaCollar"].includes(mt)){let{pts:_,py:A}=ya(mt==="corazonCristal"||mt==="lunaCollar"||mt==="mariposaCollar"?.53:.515),B=z=>X.frontZ(z)+.014,ae=e.necklace.color??16738842,de=mt==="colmilloFuego"?nt("chrome",2763312,16747066,{scale:60}):mt==="amuleto"?nt("chrome",13225174,10152191,{scale:60}):mt==="corazonCristal"||mt==="mariposaCollar"?nt("glitter",15784191,16777215):mt==="calaveraCr"?nt("chrome",10133680,16777215,{scale:60}):nt("chrome",14263866,16773792,{scale:60});he(ne,new wn(new wi(_,!0),140,.0027,5,!0),de,{outline:.0012}),he(ne,Pe("loop",()=>new wt(.0055,.0016,5,12)),de,{pos:[0,A-.006,B(A)],outline:0});let ye=A-.03,M=(z,J,fe={})=>he(ne,z,J,{pos:[0,ye,B(ye)+.002],rot:[-.12,0,0],outline:.0015,...fe});if(mt==="colmilloFuego"){let z=nt("fire",ae,16769120,{scale:70});M(Pe("dfang",()=>new Qt(.014,.05,5).scale(1,1,.45)),z,{rot:[-.12,0,Math.PI],pos:[0,ye-.008,B(ye-.008)]});for(let J of[-1,1])he(ne,Pe("dfang2",()=>new Qt(.008,.026,5).scale(1,1,.45)),z,{pos:[J*.022,A-.016,B(A-.016)],rot:[-.12,0,Math.PI+J*.35],outline:.0012})}if(mt==="amuleto"&&(M(Pe("amu",()=>new Ke(.024,.024,.006,24).rotateX(Math.PI/2)),nt("electric",1054794,ae,{scale:70})),M(Pe("amuR",()=>new wt(.024,.0025,6,28)),de,{outline:.001}),M(Pe("amuB",()=>new ri(Jp(.03),{depth:.002,bevelEnabled:!1})),new Pt({color:new ke(ae).multiplyScalar(2.4)}),{pos:[0,ye,B(ye)+.006],outline:0})),mt==="calaveraCr"){M(Pe("skullP",()=>new bt(.016,14,10).scale(1,1.05,.7)),de),he(ne,Pe("skullJ",()=>new Xe(.017,.01,.009)),de,{pos:[0,ye-.016,B(ye-.016)+.002],outline:.0012});let z=new Pt({color:new ke(ae).multiplyScalar(2.6)});for(let J of[-1,1])he(ne,Pe("skullE",()=>new bt(.0042,8,6)),z,{pos:[J*.0058,ye+.001,B(ye)+.0105],outline:0})}if(mt==="mariposaCollar"){let z=new ri(Wt(J=>{J.moveTo(0,0),J.bezierCurveTo(.008,.022,.032,.028,.03,.007),J.bezierCurveTo(.028,-.003,.013,-.002,.004,-.001),J.bezierCurveTo(.022,-.006,.023,-.026,.008,-.021),J.bezierCurveTo(.003,-.016,.001,-.008,0,0)}),{depth:.003,bevelEnabled:!1}).translate(0,0,-.0015);M(Pe("bflyW",()=>ao([z,z.clone().scale(-1,1,1)])),nt("holo",ae,16777215,{scale:90,side:Vt})),he(ne,Pe("bflyB",()=>new Kr(.003,.02,3,6)),Ee(1708080),{pos:[0,ye-.002,B(ye)+.004],outline:.001})}if(mt==="corazonCristal"&&M(Pe("hpendL",()=>new ri(Yl(.024),{depth:.006,bevelEnabled:!0,bevelSize:.003,bevelThickness:.003,bevelSegments:2}).translate(0,0,-.003)),nt("crystal",ae,16777215,{scale:90})),mt==="lunaCollar"){M(Pe("moonP",()=>new ri(Ef(0,0,.026,-.014,.008,.021),{depth:.005,bevelEnabled:!0,bevelSize:.0015,bevelThickness:.0015,bevelSegments:1}).translate(0,0,-.0025)),nt("galaxy",ae,2808063,{scale:90}));for(let[z,J,fe]of[[.03,.014,.008],[-.026,-.012,.006]])he(ne,Pe("mstar"+fe,()=>new ri(ua(0,0,fe,fe*.42),{depth:.002,bevelEnabled:!1})),nt("glitter",16765498,16777215),{pos:[z,ye+J,B(ye+J)+.003],outline:.001})}}if(mt==="pinchos"||mt==="choker"||mt==="chokerTachas"){let _=n?.654+(r.neck??0)*.5:.652,A=mt==="pinchos"?.015:.0105,B=ye=>ye.part===0?A-Math.abs(ye.s-_):-1;this.skin(hn(X,ye=>B(ye)>-.03,.006,!1,B).geo,sa(Ee(mt==="choker"?e.necklace.color??1447446:1446420,{side:Vt})),.003);let ae=new Ar;if(mt==="pinchos")for(let ye=0;ye<11;ye++){let M=(ye/10-.5)*3.4,z=Ir(_,M,.006);ae.add(qn,new Qt(.0055,.016,6),[z.x,z.y,z.z],[Math.cos(M)*Math.PI/2,0,-Math.sin(M)*Math.PI/2])}if(mt==="chokerTachas")for(let ye=0;ye<9;ye++){let M=(ye/8-.5)*2.8;if(Math.abs(M)<.2)continue;let z=Ir(_,M,.0062);ae.add(qn,new bt(.0036,6,4),[z.x,z.y,z.z])}ae.build(this.neck);let de=Ir(_,0,.0075);he(this.neck,Pe("oring",()=>new wt(.0075,.0017,5,14)),mt==="choker"?q.metal:qn,{pos:[de.x,de.y-.007,de.z],outline:0}),mt==="choker"&&he(this.neck,Pe("hcharm",()=>new ri(Yl(.008),{depth:.003,bevelEnabled:!1})),Ee(e.necklace.pendant??16730778),{pos:[de.x,de.y-.02,de.z],outline:.001})}let ti=e.bracelets?.type&&e.bracelets.type!=="none"&&!((Gi==="jacket"||Gi==="chaquetaNeon")&&e.top.accent)?e.bracelets.type:null,mn=e.bracelets?.color??1447446,Vi=Ee(mn);if(ti)for(let _ of[0,1]){let A=new Ar,B=-.275,ae=_?-1:1,de=(M,z,J)=>{for(let fe=0;fe<M;fe++){let me=fe/M*Math.PI*2;J(me,Math.sin(me)*z,Math.cos(me)*z,fe)}},ye=(M,z,J,fe,me)=>A.add(fe,me,[z,B,J],[Math.cos(M)*Math.PI/2,0,-Math.sin(M)*Math.PI/2]);if((ti==="tachas"||ti==="cuero")&&he(L[_],Pe("wrist"+ti,()=>new Ke(.043,.045,ti==="cuero"?.07:.05,14).translate(0,B,0)),Vi,{outline:.004}),ti==="tachas"&&de(8,.046,(M,z,J)=>ye(M,z,J,q.metal,new Qt(.006,.012,5))),ti==="cuero")for(let M of[-.017,.017])A.add(Ee(ei(mn,.55)),new wt(.0465,.0035,5,20).rotateX(Math.PI/2),[0,B+M,0]),A.add(q.metal,new Xe(.004,.014,.012),[ae*.05,B+M,0]);if(ti==="cadena"&&de(12,.045,(M,z,J,fe)=>A.add(Vi,new wt(.0065,.0018,4,8),[z,B,J],fe%2?[Math.PI/2,0,0]:[0,M,0])),ti==="aros")for(let M=0;M<3;M++)A.add(M===1?q.gold:Vi,new wt(.0475,.0032,5,22).rotateX(Math.PI/2+(M-1)*.12),[0,B+.01-M*.012,0]);if(ti==="perlas"&&de(16,.047,(M,z,J)=>A.add(Vi,new bt(.0058,8,6),[z,B,J])),ti==="puas"&&(he(L[_],Pe("wristP",()=>new Ke(.044,.045,.024,14).translate(0,B,0)),Ee(1446420),{outline:.003}),de(8,.046,(M,z,J)=>ye(M,z,J,Vi,new Qt(.0045,.016,5)))),ti==="magmaBr"&&(he(L[_],Pe("wristM",()=>new Ke(.045,.047,.075,16).translate(0,B,0)),nt("lava",mn,16734736,{scale:50}),{outline:.004}),de(8,.048,(M,z,J)=>ye(M,z,J,nt("chrome",3816004,16747066,{scale:80}),new Qt(.006,.016,5)))),ti==="teslaBr"){he(L[_],Pe("wristT",()=>new Ke(.044,.045,.06,14).translate(0,B,0)),nt("electric",1054794,mn,{scale:80}),{outline:.003});for(let M=0;M<4;M++)A.add(nt("chrome",10133680,16777215,{scale:80}),new wt(.047,.0035,6,22).rotateX(Math.PI/2),[0,B+.024-M*.016,0])}if(ti==="diamanteBr")for(let M=0;M<3;M++)A.add(nt(M===1?"crystal":"glitter",mn,16777215,{scale:90}),new wt(.0475,.0042,6,24).rotateX(Math.PI/2+(M-1)*.12),[0,B+.012-M*.013,0]);if(ti==="galaxiaBr"){he(L[_],Pe("wristG",()=>new Ke(.045,.047,.07,16).translate(0,B,0)),nt("galaxy",mn,3856639,{scale:50}),{outline:.004});for(let M of[-.034,.034])A.add(nt("chrome",13225174,16777215,{scale:80}),new wt(.0475,.0032,6,22).rotateX(Math.PI/2),[0,B+M,0])}if(ti==="fuegoBr")for(let M=0;M<3;M++)A.add(nt("fire",mn,16769120,{scale:60}),new wt(.047,.0045,8,26).rotateX(Math.PI/2+(M-1)*.15),[0,B+.012-M*.012,0]);if(ti==="luzBr")for(let M=0;M<2;M++)A.add(nt("neon",mn,4905215,{scale:60}),new wt(.047,.005,8,26).rotateX(Math.PI/2),[0,B+.008-M*.016,0]);A.build(L[_])}if((e.nails||n)&&!["completos","largos","tesla","garrasMagma","guanteHolo"].includes(w)){let _=Ee(e.nails??ei(e.skin,1.12)),A=Pe("nail",()=>new bt(1,10,6)),B=new Ze;for(let ae=0;ae<2;ae++)X.hand[ae].tips.forEach((de,ye)=>{let M=A.clone(),z=P().crossVectors(de.d,de.n);M.scale(de.r*.66,de.l*.3,de.r*.28).applyMatrix4(B.makeBasis(z,de.d,de.n));let J=X.hand[ae].fingers[ye][2];he(oe[ae][ye][2],M,_,{pos:[de.p.x-J.x,de.p.y-J.y,de.p.z-J.z],outline:.0015})})}if(w==="tachas")for(let _=0;_<2;_++){let A=_?-1:1;for(let B=0;B<4;B++)he(oe[_][B][0],Pe("kstud",()=>new Qt(.0042,.009,6)),q.metal,{pos:[A*.0118,-.003,0],rot:[0,0,-A*Math.PI/2],outline:.0015})}if(w==="garrasMagma"){let _=nt("chrome",3816004,16747066,{scale:60,side:ni}),A=new Ze;for(let B=0;B<2;B++)X.hand[B].tips.forEach((ae,de)=>{let ye=new Qt(1,1,6).translate(0,.5,0);ye.scale(ae.r*.7,.022,ae.r*.55).applyMatrix4(A.makeBasis(P().crossVectors(ae.d,ae.n),ae.d,ae.n));let M=X.hand[B].fingers[de][2];he(oe[B][de][2],ye,_,{pos:[ae.p.x-M.x,ae.p.y-M.y,ae.p.z-M.z],outline:.0015})})}if(w==="tesla")for(let _=0;_<2;_++){let A=_?-1:1;for(let B=0;B<4;B++)he(oe[_][B][0],Pe("tstud",()=>new bt(.0045,8,6)),nt("neon",7002367,16777215,{scale:80}),{pos:[A*.0118,-.003,0],outline:.001})}this.arms=[0,1].map(_=>({hand:{g:N[_],fingers:oe[_]},elbow:P(),wrist:P(),side:_===0?1:-1})),this.tgt=[new vt,new vt];let bo=c?new Pt({color:new ke({lava:16738842,chrome:10152191,crystal:12577023}[c[1]]??16751336).multiplyScalar(2.2)}):null;if(this.legs=[0,1].map(_=>{let A=_===0?1:-1,B=new ht;l.add(B),he(B,Pe("shoe"+d,()=>J1(d)),q.shoe,{outline:.007,shadow:!0}),he(B,Pe("sole"+d,()=>K1(d)),q.sole,{outline:.006}),he(B,Pe("welt"+d,()=>Z1(d)),bo??Ee(e.shoes?.trim??(d==="boot"?7031340:d==="sneaker"?14165547:4380234)),{outline:0});let ae=(ye,M,z)=>{let J=0,fe=1e9;X.meta.forEach((Le,Fe)=>{if(Le.part!==3+_)return;let qe=(Le.s-ye)**2+(Cr(Le.a-M)*.05)**2;qe<fe&&(fe=qe,J=Fe)});let me=X.geo.attributes.position,De=X.geo.attributes.normal;return V[_].worldToLocal(P().fromBufferAttribute(me,J).addScaledVector(P().fromBufferAttribute(De,J),z))};if(h==="chelsea"&&he(V[_],Pe("ptab",()=>new Xe(.024,.04,.005)),Ee(ei(te,.6)),{pos:ae(-.8,Math.PI,.02).toArray(),outline:.002}),h==="hightops"&&he(V[_],Pe("hstar",()=>new ri(ua(0,0,.022,.009),{depth:.003,bevelEnabled:!1}).rotateY(Math.PI/2)),Ee(new ke(e.ui||"#ffffff").getHex()),{pos:ae(-.91,A*Math.PI/2,.018).toArray(),rot:[0,A>0?0:Math.PI,0],outline:.0015}),h==="tallboots")for(let ye of[-.58,-.7,-.82])he(V[_],Pe("tbuck",()=>new Xe(.006,.022,.018)),q.metal,{pos:ae(ye,A*Math.PI/2,.02).toArray(),outline:.0015});if(h==="boot")for(let ye=0;ye<3;ye++){let M=.03+ye*.032,z=-.008-ye*.013;for(let J of[-1,1])he(B,Pe("lace"+J,()=>new Xe(.044,.005,.008).rotateY(J*.5)),Ee(9071172),{pos:[0,z,M],rot:[.55,0,0],outline:0});for(let J of[-1,1])he(B,Pe("eyelet",()=>new bt(.0045,6,4)),q.metal,{pos:[J*.024,z-.002,M],outline:0})}if(e.shoes?.type==="botasCromo")for(let ye=0;ye<2;ye++)he(B,Pe("hspike",()=>new Qt(.009,.03,6)),q.shoe,{pos:[0,-.035+ye*.026,-.085],rot:[-Math.PI/2,0,0],outline:.002});if(e.shoes?.type==="botasInfierno"&&_===0&&this.auraQ.push({kind:"lava",cols:[te],a:16734736,b:16764992}),d==="sneaker"){he(B,Pe("toecap",()=>new bt(.05,14,10,0,Math.PI*2,0,Math.PI/2).scale(1.05,.55,.9)),q.sole,{pos:[0,-.07,.15],outline:.004});for(let ye=0;ye<3;ye++)he(B,Pe("lace",()=>new Xe(.05,.006,.01)),q.sole,{pos:[0,-.012-ye*.012,.045+ye*.03],rot:[.5,0,0],outline:0})}h==="platform"&&(he(B,Pe("pstrap",()=>new wt(.052,.008,6,18).scale(1,1,1.1).rotateX(1.1)),q.shoe,{pos:[0,-.045,.05],outline:.003}),he(B,Pe("pbtn",()=>new bt(.008,8,6)),q.metal,{pos:[.052,-.04,.05],outline:0}));let de=P(A*.21,this.ankleH,A>0?.08:-.05);return{foot:B,knee:P(),ankle:P(),ft:de,cur:de.clone(),yaw:A*.28,side:A}}),this.poleMk=[new vt,new vt],this.poleMk[0].position.set(u+.45,.1,-.4),this.poleMk[1].position.set(-u-.35,.55,.22),ne.add(...this.poleMk),t==="guitar"){let _=this.gtr=wf(e.guitar),A={vee:.06,explorer:.04,hacha:.05,rayoG:.05,mariposa:.03,luna:.02}[e.guitar.type]??0;this.gBase={x:-.09+A,y:.08,z:X.frontZ(.08)+.1+(ve?.01:0),rx:-.1,ry:-.38,rz:.42},_.g.position.set(this.gBase.x,this.gBase.y,this.gBase.z),_.g.rotation.set(this.gBase.rx,this.gBase.ry,this.gBase.rz),_.g.scale.setScalar(.9),ne.add(_.g),_.g.updateMatrix();let B=P(_.T.tailBtn[0],_.T.tailBtn[1],-.02).applyMatrix4(_.g.matrix),ae=P(_.T.hornBtn[0],_.T.hornBtn[1],-.02).applyMatrix4(_.g.matrix),de=["leather","jacket","infernal","cromo"].includes(Gi)?.02:.01,ye=[ae,P(u*.5,.44,X.frontZ(.44)+(n?Di.h*(r.bust??1)*Lf(u*.5,.44):0)+de+.012),P(u*.78,n?.632:.6,0),P(u*.55,.5,-X.backZ(.5)-de),P(-.04,.28,-X.backZ(.28)-de),P(-m*1.1,.08,-X.backZ(.08)*.6),B];he(ne,uo(ye,.024,.024,40,6,.22),q.leather,{outline:.003}),he(this.arms[1].hand.g,Pe("plectrum",()=>new Ke(.013,.013,.002,3).rotateX(Math.PI/2)),Ee(new ke(e.ui||"#ffffff").getHex()),{pos:[.014,-.088,.03],rot:[0,0,Math.PI/2],outline:.002}),this.ovS=new vt,this.ovF=new vt,ne.add(this.ovS,this.ovF)}else if(t==="singer")ne.add(this.tgt[0]),this.tgt[0].position.set(.35,.55,.4),ne.add(this.tgt[1]);else if(t==="drummer"){l.add(this.tgt[0],this.tgt[1]);for(let _ of this.arms)he(_.hand.g,Pe("stick",()=>new Ke(.008,.011,.42,6).translate(0,.21,0)),Ee(15323034),{pos:[-_.side*.022,-.1,-.06],rot:[Math.PI/2+.25,0,0],outline:.004});this.hipRest=.62,this.handPtr=[0,0];for(let _ of this.legs)_.ft.set(_.side*.24,this.ankleH,.42),_.cur.copy(_.ft)}if(l.scale.setScalar(r.height??1),l.updateMatrixWorld(!0),this.chains.length){let _=[];for(let A of this.chains){let B=_.length,ae=A.meshes[0].geometry.attributes.skinIndex;if(B){for(let de=0;de<ae.array.length;de++)ae.array[de]+=B;ae.needsUpdate=!0}_.push(...A.bones)}this.chainSk=new js(_);for(let A of this.chains)for(let B of A.meshes)B.bind(this.chainSk)}for(let _ of this.auraQ){let A=[];l.traverse(ae=>{let de=ae.isMesh&&!ae.material?.userData?.ol&&ae.material?.userData?.legArgs;de&&de[0]===_.kind&&_.cols.includes(de[1])&&A.push(ae)});let B=Sf(_.a,_.b,_.bolt);for(let ae of A){let de=ae.isSkinnedMesh?new vr(ae.geometry,B):new yt(ae.geometry,B);de.position.copy(ae.position),de.quaternion.copy(ae.quaternion),de.scale.copy(ae.scale),de.frustumCulled=!1,de.renderOrder=6,ae.parent.add(de),ae.isSkinnedMesh&&de.bind(ae.skeleton,ae.bindMatrix)}}this.p={...nf},this.moves=[],this.hs={hw:0,hv:0,hz:0,hzv:0,tw:0,tv:0,tz:0,tzv:0,y:0,yv:0},this.st={strumT:-9,strumDir:1,strumAmp:.07,fret:5,fx:Er(5),I:.5,conf:0,blinkAt:2,blinkT:-9,mouthS:0,riffPtr:0,sustainEnd:0,bend:-9}}skin(e,t,n=.008){let r=new vr(e,t);if(r.frustumCulled=!1,r.castShadow=!0,this.root.add(r),r.bind(this.skel,this._I),n>0){let a=new vr(e,hc(n,!!e.attributes.olw,!!e.attributes.clp));a.frustumCulled=!1,this.root.add(a),a.bind(this.skel,this._I)}return r}simHair(e){if(!this.chains?.length||e<=0)return;let t=Math.min(e,1/30),n=Math.pow(.8,t*60),r=this.face.getWorldPosition(nv),a=.118*this.root.scale.x;for(let s of this.chains){let o=s.bones.length,l=s.W,c=s.P;s.par.updateWorldMatrix(!0,!1);for(let u=0;u<=o;u++)l[u].copy(s.J[u]).applyMatrix4(s.par.matrixWorld);(!c||c[0].distanceToSquared(l[0])>.09)&&(s.P=l.map(u=>u.clone()),s.Pp=l.map(u=>u.clone()));let h=s.P,d=s.Pp;h[0].copy(l[0]),d[0].copy(l[0]);for(let u=1;u<=o;u++)Sr.subVectors(h[u],d[u]).multiplyScalar(n),d[u].copy(h[u]),h[u].add(Sr),h[u].y-=1.2*t*t,h[u].lerp(l[u],Math.min(1,s.stiff*t*(1-.45*(u-1)/o)));for(let u=0;u<2;u++)for(let p=1;p<=o;p++){let m=l[p].distanceTo(l[p-1]);Sr.subVectors(h[p],h[p-1]),h[p].copy(h[p-1]).addScaledVector(Sr,m/(Sr.length()||1)),Sr.subVectors(h[p],r);let g=Sr.length();g<a&&l[p].distanceTo(r)>=a&&h[p].copy(r).addScaledVector(Sr,a/(g||1))}s.par.getWorldQuaternion(Uh),kh.copy(Uh);for(let u=0;u<o;u++)$p.subVectors(l[u+1],l[u]).normalize(),Qp.subVectors(h[u+1],h[u]).normalize(),Nh.setFromUnitVectors($p,Qp).multiply(Uh),s.bones[u].quaternion.copy(kh).invert().multiply(Nh),kh.copy(Nh)}}dispose(){this.chainSk?.dispose(),this.root.traverse(e=>{e.geometry&&!Object.values(Xh).includes(e.geometry)&&e.geometry.dispose()}),this.faceU?.uFaceTex.value.userData.glow?.dispose(),this.faceU?.uFaceTex.value.dispose(),this.root.removeFromParent()}setHand(e,t,n=0){let r=uv[t],a=this.arms[e].hand.fingers,s=this.arms[e].side;for(let c=0;c<4;c++){let[h,d]=r[c],u=-(1.5-c)*.07*(1-Se(h,0,1));a[c][0].rotation.set(u,0,-s*(h+n)),a[c][1].rotation.z=-s*(d+n*.5),a[c][2].rotation.z=-s*d*.75}let[o,l]=r[4];a[4][0].rotation.set(o*.5,0,-s*o*.55),a[4][1].rotation.z=-s*l*.6,a[4][2].rotation.z=-s*l*.7}place(e,t,n,r){this.base.set(e,t,n),this.baseYaw=r,this.root.position.set(e,t,n),this.root.rotation.y=r;for(let a of this.legs)a.cur.copy(a.ft)}addMove(e,t,n,r={}){this.moves.push({type:e,t0:t,dur:n,...r})}clearMoves(){this.moves.length=0}has(e,t){return this.moves.some(n=>n.type===e&&t>=n.t0&&t<n.t0+n.dur)}busyUntil(){let e=0;for(let t of this.moves)t.react||(e=Math.max(e,t.t0+t.dur));return e}strum(e,t,n){let r=this.st;r.strumT=e,r.strumDir=n??-r.strumDir,r.strumAmp=t}update(e,t,n,r){if(!this.root.visible)return;let a=this.p;Object.assign(a,nf),this.kind==="guitar"?this.animGuitar(e,t,n,r):this.kind==="singer"?this.animSinger(e,t,n,r):this.animDrummer(e,t,n,r),this.applyMoves(e,t,r),this.applyPose(e,n,r),this.simHair(n)}animGuitar(e,t,n,r){let a=this.p,s=this.st,o=s.conf,l=s.I,c=$l(r.bp,.62)*.85,h=Se(l*(.8+.35*o),.2,1.25);a.hipDrop=.035+.06*c*h+.04*Math.max(0,-o),a.lean=.1+.11*c*h+.18*Math.max(0,-o),a.headPitch=.04+.36*c*h-.12*Math.max(0,o),a.bodyRoll=Math.sin(r.beat*Math.PI*.5+this.seed)*.05*h,a.bodyYaw=Math.sin(e*.5+this.seed)*.12,a.torsoYaw=Math.sin(e*.33+this.seed)*.1,a.headYaw=Math.sin(e*.7+this.seed*2)*.12,a.stance=.03+.07*Math.max(0,o),a.brow=o>0?.35*o:.5*o,a.lid=o>.2?.44:.34,a.sneer=Math.max(0,o)*.6,a.mouth=(l>.9&&c>.55?.45*h:0)+Math.max(0,o-.3)*.15;let d=r.notes,u=s.riffPtr;for(u>0&&d[u-1]&&d[u-1].t>t&&(u=0);u<d.length&&d[u].t<=t;){let p=d[u++];if(t-p.t>.25)continue;!(o<-.35&&ct()<(-o-.3)*.35)&&!this.has("repair",t)&&this.strum(e,p.kind==="m"?.035:p.kind==="s"?.028:.085),s.fret=p.kind==="s"?Se(p.m-52,3,21):((p.m-40)%12+12)%12+(p.m>=50?7:3),s.sustainEnd=p.kind==="p"&&p.d>vi*.9?t+p.d:0,s.bend=p.kind==="s"&&p.d>vi*.9?t:-9}s.riffPtr=u}animSinger(e,t,n,r){let a=this.p,s=this.st,o=s.I,l=$l(r.bp,.62)*.85;a.hipDrop=.03+.045*l*(.4+o),a.bodyYaw=Math.sin(e*.5)*.12,a.bodyRoll=Math.sin(r.beat*Math.PI*.5)*.04;let c=r.vocal?1:0,h=c*Math.max(0,Math.sin(e*.7));s.mouthS=On(s.mouthS,c?Se(.25+.75*Math.abs(Math.sin(e*9.3+Math.sin(e*2.1)*3)),0,1):.05,14,n),a.mouth=s.mouthS,a.lean=-.05-.14*h+.05*l,a.headPitch=-.22*h+.16*l*(.3+o),a.headYaw=Math.sin(e*.6)*.1+(r.lookTo||0),a.headRoll=Math.sin(e*.8)*.08,a.brow=.25*h-.1,a.lid=.3+.4*h;let d=Math.floor(r.beat/8)%3,u=d===0?P(.62,1.12+.05*l,.5):d===1?P(.33,.52+.14*l,.42):P(.58,.42,.32);this.tgt[0].position.lerp(u,1-Math.exp(-8*n)),this.handL=d===0?"horns":d===1?"fist":"open"}animDrummer(e,t,n,r){let a=this.p,s=this.st.I,o=$l(r.bp,.62)*.85;a.hipDrop=0,a.bodyYaw=Math.sin(e*.7)*.06,a.lean=.12+.06*o*(.4+s),a.torsoRoll=Math.sin(r.beat*Math.PI)*.03,a.headPitch=.05+.3*o*(.3+s),a.headYaw=Math.sin(e*.5)*.15,a.mouth=s>.9?.45:.08,a.lid=.35,a.liftL=.05*Math.exp(-r.bp*10);let l=r.hands;for(let c=0;c<2;c++){let h=l[c],d=this.handPtr[c];for(d>0&&h[d-1]&&h[d-1].t>t&&(d=0);d<h.length&&h[d].t<=t;)d++;this.handPtr[c]=d;let u=h[d-1],p=h[d],m=cf[u?u.d:c?"snare":"hat"],g=cf[p?p.d:c?"snare":"hat"],f=u?u.t:t-1,y=p?p.t:t+1,x=Math.max(.05,y-f),v=Se((t-f)/x,0,1),E=Math.min(.24,x*.45)*Math.pow(Math.sin(Math.PI*v),.7);this.tgt[c].position.set(Ue(m.x,g.x,Oe(v)),Ue(m.y,g.y,Oe(v))+E,Ue(m.z,g.z,Oe(v))-E*.3)}}applyMoves(e,t,n){let r=this.p;this.moves=this.moves.filter(a=>t<a.t0+a.dur+.4);for(let a of this.moves){if(t<a.t0)continue;let s=Se((t-a.t0)/a.dur,0,1),o=Math.min(Oe(Se((t-a.t0)/.18,0,1)),Oe(Se((a.t0+a.dur-t)/.3,0,1)));if(o<=0&&a.type!=="spin")continue;let l=this.side===0?1:-1,c=Math.exp(-n.bp*5);switch(a.type){case"headbang":{let h=$l((n.beat%2+2)%2/2,.55);r.headPitch+=o*(.75*h-.22),r.lean+=o*.3*h,r.hipDrop+=o*.05*h}r.stance+=.06*o,r.lid=Ue(r.lid,.8,o);break;case"legKick":{let h=Math.sin(Math.PI*s);r.liftL+=h*.42*o,r.fwdL+=h*.3*o,r.lean-=h*.12,r.gz+=.25*h,r.mouth=Math.max(r.mouth,h*.8);break}case"guitarRaise":r.gz+=.75*o,r.gx+=.15*o,r.lean-=.32*o,r.headPitch-=.45*o,r.mouth=Math.max(r.mouth,.9*o),r.brow+=.25*o,r.stance+=.1*o,r.lid=Ue(r.lid,.15,o);break;case"leanBack":r.lean-=.5*o,r.headPitch-=.45*o,r.hipDrop+=.13*o,r.stance+=.13*o,r.gz+=.3*o,r.hipZ+=.09*o,r.mouth=Math.max(r.mouth,.55*o),r.lid=Ue(r.lid,.85,o),r.brow+=.3*o;break;case"spin":r.rootYaw+=U1(s)*Math.PI*2*(a.dir||1),r.liftR+=Math.sin(Math.PI*s)*.1;break;case"jump":{let h=Math.sin(Math.PI*s);r.rootY+=h*.5,r.liftL+=h*.2,r.liftR+=h*.26,r.gz+=.35*h,r.mouth=Math.max(r.mouth,h),r.hipDrop+=(1-h)*.08*o;break}case"taunt":r.rootYaw+=l*.85*o,r.rootX+=l*.35*o,r.lean+=.2*o,r.headPitch-=.08*o,r.mouth=Math.max(r.mouth,(.4+.5*c)*o),r.brow+=.5*o,r.lid=Ue(r.lid,.45,o),r.sneer+=o,r.lookOpp=o;break;case"stomp":r.stance+=.16*o,r.hipDrop+=.06*o;{let h=Math.max(0,Math.sin(n.beat*Math.PI));Math.floor(n.beat)%2?r.liftR+=h*.14*o:r.liftL+=h*.14*o}break;case"point":r.ovF=o,r.lookOpp=o,r.mouth=Math.max(r.mouth,.6*o),r.brow+=.4*o,r.rootYaw+=l*.4*o;break;case"lookGuitar":r.headPitch+=.5*o,r.headYaw+=.35*o,r.brow-=.4*o,r.lid=Ue(r.lid,.1,o);break;case"kneel":r.kneel=Math.max(r.kneel,o),r.gz+=.4*o,r.lean-=.25*o,r.headPitch-=.4*o,r.mouth=Math.max(r.mouth,.7*o);break;case"stagger":{let h=Math.pow(1-s,1.4)*o;r.lean-=.6*h,r.headPitch-=.45*h,r.rootX-=l*.35*Oe(Math.min(1,s*3))*o,r.rootZ-=.15*Oe(Math.min(1,s*3))*o,r.mouth=Math.max(r.mouth,o),r.brow=Ue(r.brow,-.7,o),r.lid=Ue(r.lid,-.25,o),r.shake+=h*.6,r.stance+=.12*o;break}case"shock":r.shake+=1*o,r.mouth=Math.max(r.mouth,o),r.brow=Ue(r.brow,-.8,o),r.lid=Ue(r.lid,-.3,o),r.lean-=.22*o,r.stance+=.12*o,r.gz+=.2*o;break;case"repair":r.headPitch+=.55*o,r.headYaw+=.3*o,r.brow=Ue(r.brow,-.6,o),r.mouth=Ue(r.mouth,.25,o),r.lean+=.15*o,Math.floor(t/.075)!==this.lastR&&(this.lastR=Math.floor(t/.075),this.strum(e,.03));break;case"dizzy":r.headRoll+=Math.sin(e*5)*.32*o,r.bodyRoll+=Math.sin(e*5+1)*.13*o,r.lid=Ue(r.lid,.7,o),r.mouth=Math.max(r.mouth,.35*o),r.brow-=.4*o,r.headPitch+=.15*o;break;case"struggle":r.lean+=.18*o,r.headPitch+=.2*o,r.brow-=.4*o;break;case"victory":{let h=Math.abs(Math.sin(n.beat*Math.PI));r.rootY+=h*.32*o,r.gz+=1*o,r.lean-=.3*o,r.headPitch-=.5*o,r.mouth=Math.max(r.mouth,o),r.brow+=.4*o,r.lid=Ue(r.lid,.1,o),r.ovS=o,r.liftL+=h*.12*o,r.liftR+=h*.14*o,r.handS="fist",r.lookCam=o;break}case"defeat":r.kneel=Math.max(r.kneel,o),r.headPitch+=.75*o,r.lean+=.45*o,r.gz-=.55*o,r.mouth=Ue(r.mouth,.05,o),r.brow=Ue(r.brow,-.6,o),r.lid=Ue(r.lid,.6,o),r.ovS=o,r.ovF=o*.8,r.handS="open",r.handF="open";break;case"charge":r.gz+=.6*o,r.lean-=.25*o,r.headPitch-=.3*o,r.mouth=Math.max(r.mouth,o),r.brow+=.6*o,r.lid=Ue(r.lid,.35,o),r.lookOpp=o,r.rootYaw+=l*.35*o;break}}}applyPose(e,t,n){let r=this.p,a=this.st,s=this.root,o=r.shake,l=o?(Math.sin(e*61)+Math.sin(e*37.3))*.5*o:0,c=o?(Math.sin(e*53.7)+Math.sin(e*29.1))*.5*o:0;s.position.set(this.base.x+r.rootX+l*.02,this.base.y+r.rootY,this.base.z+r.rootZ),s.rotation.y=this.baseYaw+r.rootYaw;let h=r.kneel;this.hips.position.set(r.hipX,this.hipRest-r.hipDrop-h*.42,r.hipZ+h*.05),this.hips.rotation.set(r.pelvis,r.bodyYaw+c*.08,r.bodyRoll+l*.06);let d=r.torsoYaw+l*.1,u=r.torsoRoll+c*.1;this.spine.rotation.set(r.lean*.6,d*.5,u*.6),this.chest.rotation.set(r.lean*.4,d*.5,u*.4);let p=r.headPitch+c*.15,m=r.headYaw,g=r.headRoll+l*.12;this.neck.rotation.set(p*.35,m*.4,g*.35),this.head.rotation.set(p*.65,m*.6,g*.65),e>=a.blinkAt&&(a.blinkT=e,a.blinkAt=e+Ve(1.8,5));let f=e-a.blinkT<.12?1:0,y=Math.max(r.lid,f),x=this.faceU,v=Se((y-.2)/.8,-.35,1),E=Se(Math.max(0,r.brow)*.35+r.sneer*.15,0,.6);x.uT.value=e,x.uLid.value.set(v,v,E,E*(1-r.sneer*.6));let S=Math.max(0,-r.brow)*.004+r.mouth*.0012,T=Se(r.brow,-1,1);x.uBrow.value.set(S,S+r.sneer*.003*(this.side?-1:1),T,T-r.sneer*.4);let C=Se(r.mouth,0,1);this.jaw.rotation.set(C*.3,0,r.sneer*.025*(this.side?-1:1));let L=null;r.lookOpp>.3&&this.opp?L=this.opp.face.getWorldPosition(Mr):(r.lookCam>.3||this.kind!=="drummer"&&a.conf>.3&&Math.sin(e*.37+this.seed)>.6)&&(L=Lt.position);let I=this.hsrc.eye;L&&(this.face.updateWorldMatrix(!0,!1),Bn.copy(L),this.face.worldToLocal(Bn));for(let O=0;O<2;O++){let q=Math.sin(e*.45+this.seed)*.15,se=-.05;if(L){let te=Bn.x-(O?I.x:-I.x),Ce=Bn.y-I.y;q=Se(Math.atan2(te,Bn.z),-.6,.6),se=Se(Math.atan2(Ce,Math.hypot(te,Bn.z)),-.45,.45)}let Z=this.gaze[O];Z.x=On(Z.x,q*I.hw*.7,12,t),Z.y=On(Z.y,se*I.hw*.55,12,t)}x.uGaze.value.set(this.gaze[0].x,this.gaze[0].y,this.gaze[1].x,this.gaze[1].y);let V=this.hs,X=Math.min(t,1/30),N=r.headPitch+r.lean,oe=r.headRoll+r.torsoRoll+r.bodyRoll+r.headYaw*.3,F=r.rootY-r.hipDrop-r.kneel*.42,ne=(O,q,se,Z,te)=>{V[q]+=((se-V[O])*Z-V[q]*te)*X,V[O]+=V[q]*X};ne("hw","hv",N,140,10),ne("hz","hzv",oe,110,9),ne("tw","tv",N,50,4.5),ne("tz","tzv",oe,40,4),ne("y","yv",F,70,5.5),this.hair.rotation.x=Se(V.hw-N,-.7,.7)*.5,this.hair.rotation.z=Se(V.hz-oe,-.6,.6)*.5;let $=Se((V.y-F)*5,-.45,.45);for(let O of this.tails){let q=O.userData.s??0,se=O.userData.k??1,Z=e*1.9+this.seed+q;O.rotation.x=(Se(V.tw-N,-.9,.9)*1.5+Math.sin(Z*.8)*.03)*se,O.rotation.z=(Se(V.tz-oe,-.8,.8)*1.7+q*$+Math.sin(Z)*.045)*se}if(this.kind==="guitar"){let O=this.gBase,q=this.gtr;q.g.rotation.set(O.rx+r.gx,O.ry+r.gy,O.rz+r.gz);let se=e-a.strumT,Z;se<.06?Z=a.strumDir*a.strumAmp*(1-2*Oe(se/.06)):Z=-a.strumDir*a.strumAmp*Math.exp(-(se-.06)*7),q.strum.position.set(-.01,Z,.108),a.fx=On(a.fx,Er(a.fret-.45),16,t);let te=-.045;a.sustainEnd&&n.mt<a.sustainEnd&&(te+=Math.sin(e*34)*.006),n.mt-a.bend<vi*2&&(te+=Oe(Se((n.mt-a.bend)/.2,0,1))*.018),q.fret.position.set(a.fx,te,0),r.ovS>0&&this.ovS.position.set(r.handS==="fist"?-.32:-.25,r.handS==="fist"?.95+.08*Math.exp(-n.bp*6):.05,r.handS==="fist"?.2:.18),r.ovF>0&&(r.handF==="open"?this.ovF.position.set(.3,.05,.16):this.ovF.position.set(this.side===0?1.2:.55,.75,this.side===0?.8:1.1)),this.setHand(1,r.ovS>.5?r.handS:"pick"),this.setHand(0,r.ovF>.5?r.handF==="open"?"open":"point":"grip",Math.sin(e*9)*.05)}else this.kind==="singer"?(this.setHand(0,this.handL||"fist"),this.setHand(1,"grip"),this.root.updateMatrixWorld(!0),this.tgt[1].position.copy(this.torso.worldToLocal($e.micGrip.position.clone()))):(this.setHand(0,"grip"),this.setHand(1,"grip"));for(let O of this.legs){let q=O.side,se=O.ft.x+q*r.stance,Z=O.ft.z+(q>0?r.fwdL:r.fwdR),te=this.ankleH+(q>0?r.liftL:r.liftR);h>0&&(q>0?Z+=.22*h:(Z-=.38*h,te=Ue(te,this.ankleH+.06,h))),this.fem&&(se*=.85);let Ce=Math.hypot(se-O.cur.x,Z-O.cur.z);O.cur.x=On(O.cur.x,se,14,t),O.cur.z=On(O.cur.z,Z,14,t),O.cur.y=te+Math.min(.1,Ce*.8),O.yaw=q*.28*(1-h*.5)}this.solve(h)}aim(e,t,n){oo.subVectors(n,t).normalize(),e.parent.getWorldQuaternion(ca),this.root.getWorldQuaternion(ha),ca.premultiply(ha.invert()).invert(),oo.applyQuaternion(ca),e.quaternion.setFromUnitVectors(iv,oo),e.updateMatrixWorld(!0)}solve(e=0){let t=this.root;t.updateMatrixWorld(!0);let n=this.p;for(let r=0;r<2;r++){let a=this.arms[r];this.ua[r].getWorldPosition(un),t.worldToLocal(un);let s=this.tgt[r];if(this.kind==="guitar"&&(s=r===0?this.gtr.fret:this.gtr.strum),s.getWorldPosition(Bn),this.kind==="guitar"){let c=r===0?n.ovF:n.ovS;c>0&&((r===0?this.ovF:this.ovS).getWorldPosition(Mr),Bn.lerp(Mr,Oe(Se(c,0,1))))}t.worldToLocal(Bn),this.poleMk[r].getWorldPosition(Mr),t.worldToLocal(Mr),tf(un,Bn,rc,ac,Mr,a.elbow,a.wrist);let o=un.clone();if(this.aim(this.ua[r],o,a.elbow),this.aim(this.fa[r],a.elbow,a.wrist),oo.subVectors(a.wrist,a.elbow).normalize(),ca.setFromUnitVectors(ic,oo).multiply(Zl.setFromAxisAngle(ic,a.side*.6)).multiply(hv[r]),this.kind==="guitar"){let c=Oe(Se(1-(r===0?n.ovF:n.ovS),0,1));if(c>0){this.gtr.g.getWorldQuaternion(Jl),t.getWorldQuaternion(Kl),Jl.premultiply(Kl.invert());let h=cv[r];lv(rv.copy(h.f).applyQuaternion(Jl),av.copy(h.p).applyQuaternion(Jl),r,Kl),ca.slerp(Kl,c)}}this.fa[r].getWorldQuaternion(ha),t.getWorldQuaternion(Kp),ha.premultiply(Kp.invert()),Zl.copy(ha).invert().multiply(ca);let l=Cr(2*Math.atan2(Zl.y,Zl.w));this.twB[r].quaternion.setFromAxisAngle(ic,l*.65),ha.multiply(this.twB[r].quaternion),this.handB[r].quaternion.copy(ha.invert().multiply(ca)),this.twB[r].updateMatrixWorld(!0)}for(let r=0;r<2;r++){let a=this.legs[r];this.th[r].getWorldPosition(un),t.worldToLocal(un),Mr.set(un.x*1.8,un.y*.5+(this.kind==="drummer"?.6:0)-e*.3,1.2),tf(un,a.cur,Oh,rf,Mr,a.knee,a.ankle);let s=un.clone();this.aim(this.th[r],s,a.knee),this.aim(this.sh[r],a.knee,a.ankle),a.foot.position.copy(a.ankle),a.foot.rotation.set(a.side<0&&e>.3?-.6*e:0,a.yaw,0)}this.face.updateWorldMatrix(!0,!1),this.neckU.uFaceInv.value.copy(this.face.matrixWorld).invert()}},cf={snare:P(.2,.86,.26),hat:P(.44,.98,.2),crash:P(.52,1.28,.42),ride:P(-.5,1.12,.36),tom1:P(.1,.98,.44),tom2:P(-.16,.98,.44),ftom:P(-.42,.74,.24)},Zh=class{constructor(){let e=[],t=0;for(;e.length<160&&t<9e3;){t++;let h=Ve(-12,12),d=Ve(4.7,19);Math.abs(h)>5.4&&d<5.9||Math.abs(h)<1.8&&d<4.2||Math.hypot(h-po.x,d-po.z)<1.9||e.some(u=>Math.hypot(u.x-h,u.z-d)<.6)||e.push({x:h,z:d})}let n=[14165547,2829099,3824296,15263976,7028640,3112250,14256682,10033947,4473924],r=[15845280,14459514,11893330,9067066,15382158],a=[2759184,9067054,15255658,14173226,1118481,5913120];e.sort((h,d)=>h.z-d.z),this.p=e.map(h=>({...h,yaw:Math.atan2(-h.x*.8,-(h.z+1.5)),s:Ve(.88,1.08),ph:ct(),style:Math.floor(ct()*4),j:Ve(.08,.3)}));let s=this.n=this.p.length,o=new on({color:16777215,gradientMap:fc});this.all=[];let l=(h,d,u)=>{let p=new Yr(h,o,d);if(p.userData.k=d/s,Ge.add(p),this.all.push(p),u){let m=new Yr(h,hc(u),d);m.userData.k=d/s,m.instanceMatrix=p.instanceMatrix,Ge.add(m),this.all.push(m)}return p};this.body=l(new Kr(.2,.5,2,8),s,.025),this.head=l(new bt(.14,9,6),s,.02),this.hair=l(new bt(.152,9,4,0,Math.PI*2,0,Math.PI*.55),s,0),this.arm=l(new Kr(.055,.46,1,5).translate(0,.28,0),s*2,.02),this.leg=l(new Ke(.08,.07,.8,6).translate(0,.4,0),s*2,0),this.cuantos=s;let c=new ke;this.p.forEach((h,d)=>{let u=Gn(n),p=Gn(r);this.body.setColorAt(d,c.setHex(u)),this.head.setColorAt(d,c.setHex(p)),this.hair.setColorAt(d,c.setHex(Gn(a)));for(let m=0;m<2;m++)this.arm.setColorAt(d*2+m,c.setHex(ct()<.6?p:u)),this.leg.setColorAt(d*2+m,c.setHex(Gn([3030371,2236962,3953794,5917242])))}),this.d=new vt,this.cheer=0}ponCuantos(e){this.cuantos=Math.max(1,Math.min(this.n,e|0));for(let t of this.all)t.count=this.cuantos*t.userData.k}update(e,t,n,r){let a=this.d;this.cheer=Math.max(0,this.cheer-.012);for(let s=0;s<this.cuantos;s++){let o=this.p[s],l=1+.35*r*(o.x<0?1:-1),c=Se(n*l+this.cheer,0,1.4),h=((t.beat+o.ph*.3)%1+1)%1,d=Math.exp(-h*6),u=o.j*c*d*(o.style===3?.4:1)+this.cheer*.25*Math.abs(Math.sin(e*9+o.ph*6)),p=Math.cos(o.yaw),m=Math.sin(o.yaw),g=o.s;a.scale.setScalar(g),a.position.set(o.x,1.23*g+u,o.z),a.rotation.set(.06*d*c,o.yaw,0,"YXZ"),a.updateMatrix(),this.body.setMatrixAt(s,a.matrix),a.position.set(o.x+m*.03*d*c,1.82*g+u,o.z+p*.03*d*c),a.rotation.set(.25*d*c-.1,o.yaw,0,"YXZ"),a.updateMatrix(),this.head.setMatrixAt(s,a.matrix),this.hair.setMatrixAt(s,a.matrix);for(let f=0;f<2;f++){let y=f?-1:1,x,v=0;switch(o.style){case 0:x=2.55+.25*Math.sin(e*3+o.ph*6+f);break;case 1:x=y>0?.3:2+.9*d*c;break;case 2:x=2.85+.1*Math.sin(e*2+f);break;default:x=.4,v=1+.6*d*c}x=Ue(.35,x,Se(c*1.2,0,1)),this.cheer>.3&&(x=Ue(x,2.8,Math.min(1,this.cheer)),v=0);let E=y*.25*g,S=1.56*g+u;a.position.set(o.x+E*p,S,o.z-E*m),a.rotation.set(v,o.yaw,-y*(Math.PI-x),"YXZ"),a.updateMatrix(),this.arm.setMatrixAt(s*2+f,a.matrix),a.position.set(o.x+y*.1*g*p,u*.6,o.z-y*.1*g*m),a.rotation.set(0,o.yaw,0,"YXZ"),a.updateMatrix(),this.leg.setMatrixAt(s*2+f,a.matrix)}}for(let s of[this.body,this.head,this.hair,this.arm,this.leg])s.instanceMatrix.needsUpdate=!0}},Jh=class{constructor(e=2500){this.n=e,this.i=0,this.alive=0,this.colDirty=!1;let t=new ut;this.pos=new Float32Array(e*3),this.col=new Float32Array(e*3),this.size=new Float32Array(e),this.alpha=new Float32Array(e),this.vel=new Float32Array(e*3),this.life=new Float32Array(e),this.max=new Float32Array(e),this.grav=new Float32Array(e),this.drag=new Float32Array(e),this.s0=new Float32Array(e),t.setAttribute("position",new jt(this.pos,3)),t.setAttribute("color",new jt(this.col,3)),t.setAttribute("size",new jt(this.size,1)),t.setAttribute("alpha",new jt(this.alpha,1)),this.u={uScale:{value:400},uMap:{value:We.glow}},this.mesh=new Ys(t,new qt({uniforms:this.u,transparent:!0,depthWrite:!1,blending:ln,vertexShader:`attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,fragmentShader:"uniform sampler2D uMap; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vC*t.a*vA,1.0); }",vertexColors:!0})),this.mesh.frustumCulled=!1,Ge.add(this.mesh)}emit(e,t,n={}){let r=new ke(n.color??16760928).multiplyScalar(n.bright??2.5),a=n.color2!==void 0?new ke(n.color2).multiplyScalar(n.bright??2.5):r;for(let s=0;s<t;s++){let o=this.i;this.i=(this.i+1)%this.n;let l=n.speed??3,c=n.jitter??.02,h=P(Ve(-1,1),Ve(-1,1),Ve(-1,1)).normalize().multiplyScalar(l*Ve(.4,1));n.dir&&h.add(n.dir.clone().multiplyScalar(Ve(.6,1.2))),this.pos.set([e.x+Ve(-c,c),e.y+Ve(-c,c),e.z+Ve(-c,c)],o*3),this.vel.set([h.x,h.y,h.z],o*3);let d=ct()<.5?a:r;this.col.set([d.r,d.g,d.b],o*3),this.alive=1,this.colDirty=!0,this.life[o]=this.max[o]=Ve(.6,1)*(n.life??.8),this.grav[o]=n.grav??-6,this.drag[o]=n.drag??1.5,this.s0[o]=(n.size??.05)*Ve(.6,1.2)}}update(e){if(!this.alive)return;let t=this.pos,n=this.vel,r=0;for(let s=0;s<this.n;s++){if(this.life[s]<=0){this.alpha[s]=0;continue}r++,this.life[s]-=e;let o=Math.exp(-this.drag[s]*e);n[s*3]*=o,n[s*3+1]=n[s*3+1]*o+this.grav[s]*e,n[s*3+2]*=o,t[s*3]+=n[s*3]*e,t[s*3+1]+=n[s*3+1]*e,t[s*3+2]+=n[s*3+2]*e,t[s*3+1]<.02&&(t[s*3+1]=.02,n[s*3+1]*=-.3);let l=this.life[s]/this.max[s];this.alpha[s]=Math.min(1,l*2),this.size[s]=this.s0[s]*(.4+.6*l)}let a=this.mesh.geometry.attributes;a.position.needsUpdate=a.size.needsUpdate=a.alpha.needsUpdate=!0,this.colDirty&&(a.color.needsUpdate=!0,this.colDirty=!1),this.alive=r}},Kh=class{constructor(){this.N=34,this.active=!1;let e=(t,n)=>{let r=new ut;r.setAttribute("position",new jt(new Float32Array((this.N+1)*2*3),3));let a=[];for(let o=0;o<this.N;o++){let l=o*2;a.push(l,l+1,l+2,l+1,l+3,l+2)}r.setIndex(a);let s=new yt(r,n);return s.frustumCulled=!1,s.visible=!1,Ge.add(s),{m:s,w:t}};this.core=e(.018,new Pt({color:new ke(6,6,6),toneMapped:!1,transparent:!0,depthWrite:!1,blending:ln,side:Vt})),this.glow=e(.09,new Pt({color:16777215,toneMapped:!1,transparent:!0,depthWrite:!1,blending:ln,side:Vt,opacity:.55})),this.pts=Array.from({length:this.N+1},()=>P())}fire(e,t,n,r){this.fromFn=e,this.toFn=t,this.t0=Zt.t,this.dur=n,this.active=!0,this.glow.m.material.color.setRGB(...r),this.core.m.material.color.setRGB(r[0]*.6+3,r[1]*.6+3,r[2]*.6+3),this.regen=0}update(e){if(!this.active)return;let t=(Zt.t-this.t0)/this.dur;if(t>1){this.active=!1,this.core.m.visible=this.glow.m.visible=!1;return}let n=this.fromFn(),r=this.toFn(),a=Se(t*5,0,1);if(this.regen-=e,this.regen<=0){this.regen=.045;let h=n.distanceTo(r)*.08;for(let d=0;d<=this.N;d++){let u=d/this.N*a;this.pts[d].lerpVectors(n,r,u);let p=Math.sin(Math.PI*(d/this.N))*h;this.pts[d].add(P(Ve(-p,p),Ve(-p,p)+Math.sin(Math.PI*u)*h*1.5,Ve(-p,p)))}}let s=t>.75?1-(t-.75)/.25:1,o=P(),l=P(),c=P();for(let h of[this.core,this.glow]){let d=h.m.geometry.attributes.position;h.m.visible=!0,h.m.material.opacity=(h===this.glow?.55:1)*s*(.7+.3*Math.sin(Zt.t*60));for(let u=0;u<=this.N;u++){let p=this.pts[u],m=this.pts[Math.min(this.N,u+1)],g=this.pts[Math.max(0,u-1)];o.subVectors(m,g).normalize(),l.subVectors(Lt.position,p).normalize(),c.crossVectors(o,l).normalize().multiplyScalar(h.w*(1-.5*u/this.N)),d.setXYZ(u*2,p.x+c.x,p.y+c.y,p.z+c.z),d.setXYZ(u*2+1,p.x-c.x,p.y-c.y,p.z-c.z)}d.needsUpdate=!0}}},$h=class{constructor(e){this.x=e,this.t0=-9,this.dur=0,this.spr=[];for(let t=0;t<18;t++){let n=new En(new an({map:We.flame,color:16777215,blending:ln,transparent:!0,depthWrite:!1,opacity:0}));n.position.set(e,Ne,2.85),Ge.add(n),this.spr.push({s:n,ph:t/18})}}fire(e=1.2){this.t0=Zt.t,this.dur=e}update(e){let t=e-this.t0,n=t<this.dur?1:Math.max(0,1-(t-this.dur)/.4);for(let r of this.spr){if(n<=0){r.s.material.opacity=0;continue}let a=(e*2.6+r.ph)%1;r.s.position.set(this.x+Math.sin(r.ph*40+e*9)*.12*a,Ne+.2+a*3.2,2.85+Math.cos(r.ph*31)*.1*a),r.s.scale.setScalar((.55+a*1.1)*(1-a*.35)),r.s.material.opacity=(1-a)*n,r.s.material.color.setRGB(1.6,Ue(1.4,.45,a),Ue(.8,.1,a))}return n}},Qh=class{constructor(e=500){this.n=e,this.on=!1,this.m=new Yr(new pi(.06,.1),new Pt({side:Vt,toneMapped:!1}),e),this.m.frustumCulled=!1,this.m.visible=!1,Ge.add(this.m);let t=[16726891,16765498,6160218,5092351,12614655,16777215],n=new ke;this.p=Array.from({length:e},(r,a)=>(this.m.setColorAt(a,n.setHex(t[a%t.length]).multiplyScalar(1.4)),{p:P(),v:P(),r:P(),w:P()})),this.d=new vt}burst(){this.on=!0,this.m.visible=!0;for(let e of this.p)e.p.set(Ve(-7,7),Ve(Ne+5,Ne+9),Ve(-2,8)),e.v.set(Ve(-.4,.4),Ve(-1.6,-.8),Ve(-.4,.4)),e.r.set(ct()*6,ct()*6,ct()*6),e.w.set(Ve(-6,6),Ve(-6,6),Ve(-6,6))}update(e,t){this.on&&(this.p.forEach((n,r)=>{n.p.addScaledVector(n.v,e),n.p.x+=Math.sin(t*2+r)*.004,n.p.y<.05&&(n.p.y=.05),n.r.addScaledVector(n.w,e),this.d.position.copy(n.p),this.d.rotation.set(n.r.x,n.r.y,n.r.z),this.d.updateMatrix(),this.m.setMatrixAt(r,this.d.matrix)}),this.m.instanceMatrix.needsUpdate=!0)}stop(){this.on=!1,this.m.visible=!1}},eu=class{constructor(e=40){this.s=[];for(let t=0;t<e;t++){let n=new En(new an({map:We.smoke,color:8952234,transparent:!0,depthWrite:!1,opacity:0}));n.visible=!1,Ge.add(n),this.s.push({sp:n,life:0,max:1,v:P()})}this.i=0}puff(e,t={}){let n=this.s[this.i++%this.s.length];n.sp.position.copy(e),n.sp.visible=!0,n.life=n.max=t.life??3,n.v.set(Ve(-.2,.2),t.rise??.6,Ve(-.2,.2)),n.size=t.size??1.2,n.op=t.op??.35,n.sp.material.color.set(t.color??8952234)}update(e){for(let t of this.s){if(t.life<=0){t.sp.visible=!1;continue}t.life-=e;let n=t.life/t.max;t.sp.position.addScaledVector(t.v,e),t.sp.scale.setScalar(t.size*(1.6-n)),t.sp.material.opacity=t.op*Math.min(1,n*2)*Math.min(1,(1-n)*6)}}},Hf=[];Zt={t:0,run:!0};pn?await Promise.race([jv(),Gp(2500)]).catch(()=>{}):await Promise.race([document.fonts.load("80px Bangers"),Gp(2500)]).catch(()=>{});$1();ev();Fv();Hn=new Zh,Ni=new Jh,Ff=new Kh,ms=new eu,ma=new Qh,da=[-5.6,-2,2,5.6].map(i=>new $h(i)),Qi={};Wn=new ys(xf.singer,"singer");Wn.place(0,Ne,1.15,0);Ge.add(Wn.root);jn=new ys(xf.drummer,"drummer");jn.place(0,Ne+.3,-2.85,0);Ge.add(jn.root);us=Wv(),zt={L:"violeta",Rr:"rex",win:"rand",cam:"auto",titles:!0,bars:!0,loop:!0,fixed:!1},Bi=()=>Gf(zt.L),Fn=()=>Gf(zt.Rr),Rr=0,St={on:!1,solo:!1,mt:0,raw:-1,ko:null,animoT:0,fin:null},Fh=5*Yt,uf=59*Yt,Xv=i=>i<uf?Math.max(0,i):Fh+(i-Fh)%(uf-Fh),xi=()=>St.on&&St.solo,qv=()=>xi()?[Bi()]:[Bi(),Fn()],_t={start(){this.t0=Zt.t,this.winner=zt.win==="rand"?ct()<.5?0:1:+zt.win,this.mom=0,this.momT=0,this.seqs=[],this.ko=!1,this.lastBar=-1,this.ei=0,this.visPtr=0;for(let a in Qi)Qi[a].root.visible=!1;let i=Bi(),e=Fn();i.root.visible=!0,e.root.visible=!xi(),xi()?i.place(0,Ne,.95,0):(i.place(-3.4,Ne,.72,.3),e.place(3.4,Ne,.72,-.3)),i.side=0,e.side=1,i.opp=e,e.opp=i,Wn.root.visible=$e.micSet.visible=!xi(),jn.root.visible=!0;for(let a of[i,e,Wn,jn])a.clearMoves(),a.st.riffPtr=0,a.st.conf=0,a.handPtr&&(a.handPtr=[0,0]);let t=[],n=Wp.length,r="";St.on||Wp.forEach((a,s)=>{let o=s/(n-1),l=o<.35?.3:o<.7?.5:.82,c=s===n-1?this.winner:ct()<l?this.winner:1-this.winner,h;do h=Gn(Object.keys(ho));while(h===r);r=h,t.push({t:a*Yt-vi*.1,from:c,kind:h})}),this.events=t,ma.stop(),Ki.reset(),xi()?$i.solo(zt.L):$i.vs(zt.L,zt.Rr)},mt(){return St.on?St.mt:Zt.t-this.t0},rewound(){this.lastBar=-1,this.visPtr=0;for(let i of[Bi(),Fn(),Wn,jn])i.st.riffPtr=0,i.handPtr&&(i.handPtr=[0,0]),this.ko||i.clearMoves();this.seqs=[]},attack(i,e){if(xi()||this.ko)return;let t=this.mt(),n=i===0?Bi():Fn(),r=i===0?Fn():Bi();this.seqs.push({from:i,kind:e,t0:t,A:n,T:r,stage:0}),n.addMove("charge",t,1.25,{react:!0}),Ki.event("attacker",i,.7)},hype(i,e,t){if(this.ko)return;let n=this.mt(),r=Bi();if(i==="sp"){r.addMove("jump",n,vi*1.2,{react:!0}),r.addMove("guitarRaise",n+vi*1.2,Yt,{react:!0});for(let a of da)a.fire(1.2);Rr=1,$e.lights.fx.position.copy(r.gtr.g.localToWorld(P(0,0,.05))),$e.lights.fx.color.set(t||"#6fd8ff")}else if(i==="racha")r.addMove(ct()<.5?"spin":"legKick",n,vi*1.6,{react:!0,dir:1}),da[ct()<.5?1:2].fire(1);else if(i==="falla"){r.addMove(ct()<.5?"struggle":"lookGuitar",n,Yt,{react:!0});return}Hn.cheer=Math.max(Hn.cheer,i==="sp"?1:.7),e&&$i.call(e,t||"#ffd23a"),Ki.event("target",0,1.2)},update(i){let e=this.mt();for(;this.ei<this.events.length&&this.events[this.ei].t<=e;){let a=this.events[this.ei++];this.ko||this.attack(a.from,a.kind)}for(let a of this.seqs){let s=e-a.t0;if(a.stage===0&&(a.A.gtr.tip.getWorldPosition(un),Math.floor(s*30)!==a.k&&(a.k=Math.floor(s*30),Ni.emit(un,3,{color:ho[a.kind].color,speed:1.2,life:.4,size:.06,grav:0}))),a.stage===0&&s>.55){a.stage=1;let o=ho[a.kind],l=a.kind==="amp",c=$e.amps[a.T.side===0?0:1];Ff.fire(()=>a.A.gtr.tip.getWorldPosition(P()),()=>l?c.localToWorld(P(0,.9,.3)):a.T.gtr.g.localToWorld(P(0,0,.05)),.85,o.bolt),Ki.event("faceoff",a.from,.9),Ki.shake=.6}if(a.stage===1&&s>.7){a.stage=2;let o=ho[a.kind],l=a.T,c=l.gtr.g.localToWorld(P(0,0,.05));switch(Ni.emit(c,70,{color:o.color,color2:16777215,speed:4,life:.9,size:.07}),St.on||(this.momT=Se(this.momT+(a.from===0?1:-1)*.24,-.85,.85)),Hn.cheer=.8,$i.call(o.name,o.color),$e.lights.fx.position.copy(c),$e.lights.fx.color.set(o.color),Rr=1,a.kind){case"shock":l.addMove("shock",e,1.7,{react:!0}),a.zap=e+1.6;break;case"fire":{da.reduce((d,u)=>Math.abs(u.x-l.base.x)<Math.abs(d.x-l.base.x)?u:d).fire(1.3),l.addMove("stagger",e,1.6,{react:!0}),ms.puff(P(l.base.x,Ne+1,2),{size:2,life:3,op:.25,color:5588019});break}case"broken":l.addMove("stagger",e,.6,{react:!0}),l.addMove("repair",e+.45,2.6,{react:!0}),Ni.emit(c,40,{color:16777215,speed:2,life:.6,size:.04});break;case"lefty":l.addMove("spin",e,.8,{react:!0,dir:l.side?1:-1}),l.addMove("dizzy",e+.7,2.2,{react:!0});break;case"amp":{let h=$e.amps[l.side].localToWorld(P(0,1,.3));Ni.emit(h,90,{color:16765024,color2:o.color,speed:4.5,life:1.2,size:.07});for(let d=0;d<6;d++)ms.puff(h.clone().add(P(Ve(-.3,.3),Ve(0,.5),0)),{size:1.4,life:4,op:.45,color:3355448,rise:.5});a.ampT=e+3.5,a.ampPos=h,l.addMove("stagger",e,1.3,{react:!0}),l.addMove("lookGuitar",e+1.2,1.2,{react:!0});break}}}if(a.stage===2&&s>1.35&&(a.stage=3,Ki.event("target",1-a.from,1.5)),a.zap&&e<a.zap){let o=a.T.gtr.g.localToWorld(P(Ve(-.2,.2),Ve(-.3,.6),.1));Ni.emit(o,2,{color:7330047,speed:2.5,life:.25,size:.05,grav:0}),Rr=Math.max(Rr,.4+.4*ct())}a.ampT&&e<a.ampT&&ct()<.15&&(Ni.emit(a.ampPos,6,{color:16760928,speed:2,life:.5,size:.05}),ms.puff(a.ampPos.clone().add(P(Ve(-.3,.3),.2,0)),{size:1.2,life:3,op:.35,color:2763310}))}this.seqs=this.seqs.filter(a=>e-a.t0<4),this.mom=On(this.mom,this.momT,1.2,i);let t=Bi(),n=Fn();t.st.conf=this.mom,n.st.conf=-this.mom;let r=V1*Yt;if(!this.ko&&(St.on?St.ko!==null:e>=r)){if(this.ko=!0,St.on&&(this.winner=St.ko),xi()){t.clearMoves(),t.addMove("jump",e,.55,{react:!0}),t.addMove("victory",e+.4,999,{react:!0});for(let o of da)o.fire(2.2);ma.burst(),Hn.cheer=1.4,$i.fin(St.fin||"\xA1OVACI\xD3N!",zt.L),Ki.event("winner",0,6);return}this.momT=this.winner===0?1:-1;let a=this.winner===0?t:n,s=this.winner===0?n:t;a.clearMoves(),s.clearMoves(),a.addMove("jump",e,.55,{react:!0}),a.addMove("victory",e+.4,999,{react:!0}),s.addMove("stagger",e,.9,{react:!0}),s.addMove("defeat",e+.7,999,{react:!0});for(let o of da)o.fire(2.2);ma.burst(),Hn.cheer=1.4,$i.ko(this.winner===0?zt.L:zt.Rr),Ki.event("winner",this.winner,6)}this.ko&&!St.on&&e>r+12&&zt.loop&&this.start()},onBar(i,e,t){for(let n of qv()){if(this.ko||n.busyUntil()>t+.05||n.moves.some(c=>c.react&&t<c.t0+c.dur))continue;let r=n.st.conf,a=au[e.name];if(i===e.bar0&&(e.name==="chorus"||e.name==="outro")){n.addMove(r>-.1?"jump":"stomp",t,r>-.1?vi*1.2:Yt),r>.15&&ct()<.5&&n.addMove("spin",t+vi*1.3,vi*1.4,{dir:n.side?-1:1});continue}if(e.name==="solo"){let c=r>=0;if(i===e.bar0+7&&c){n.addMove("kneel",t,Yt),n.addMove("leanBack",t,Yt);continue}let h=Fp({leanBack:c?2:.6,headbang:1,guitarRaise:c?1:.2,struggle:c?0:1.2,lookGuitar:c?.2:.8});n.addMove(h,t,h==="leanBack"?Yt*2:Yt);continue}let o=Fp({none:1.2,headbang:1.1*a,legKick:(r>0?.7:.15)*a,guitarRaise:r>0?.6:.1,taunt:!xi()&&r>.15?.8:.08,stomp:.5,point:!xi()&&r>.3?.4:0,struggle:r<-.2?1.4:0,lookGuitar:r<-.2?.6:.05,spin:e.name==="chorus"&&r>.3?.25:0}),l={headbang:Yt*2,legKick:vi*1.6,guitarRaise:Yt,taunt:Yt*2,stomp:Yt,point:vi*2.5,struggle:Yt*2,lookGuitar:Yt,spin:vi*1.4}[o];o!=="none"&&n.addMove(o,t+(o==="legKick"?vi*2:0),l,{dir:n.side?-1:1})}}},ec=i=>i.face.getWorldPosition(P()),tc=i=>i===0?Bi():Fn(),Yv={establish:i=>{let e=Oe(Se(i/9,0,1));return{p:P(Ue(-7,0,e),Ue(14,6.3,e),Ue(27,16.5,e)),l:P(0,Ne+1.2,0),f:44,hh:.2}},wide:(i,e)=>({p:P(e.s*2.5+Math.sin(i*.08)*1.5,6.3-i*.04,17-i*.25),l:P(0,Ne+1.1,0),f:42,hh:.4}),crowdLow:(i,e)=>({p:P(e.s*3-e.s*i*.3,1.55,9.5),l:P(0,Ne+1.5,0),f:46,hh:1}),duo:(i,e)=>({p:P(-1.2*e.s+i*.12*e.s,Ne+.75,6.4-i*.08),l:P(0,Ne+1.45,0),f:50,hh:.6}),close:(i,e)=>{let t=tc(e.who),n=ec(t),r=e.who===0?1:-1;return{p:P(n.x+r*(1.05-i*.05),Ne+.62,n.z+2-i*.06),l:P(n.x+r*.05,n.y-.35,n.z),f:40,hh:.8}},hero:(i,e)=>{let t=tc(e.who),n=ec(t),r=t.root.position,a=e.who===0?1:-1;return{p:P(r.x+a*.7,Ne+.22,r.z+1.35+i*.03),l:P(n.x,n.y-.1,n.z),f:56,hh:.7}},over:(i,e)=>{let t=tc(e.who).root.position,n=e.who===0?1:-1;return{p:P(t.x-n*1.4,Ne+2.5,t.z-2.3+i*.08),l:P(t.x+n*2.2,Ne+.4,t.z+9),f:58,hh:.6}},guitar:(i,e)=>{let t=tc(e.who),n=t.gtr.g.localToWorld(P(.28,0,0)),r=t.root.localToWorld(P(0,0,1)).sub(t.root.position);return{p:n.clone().addScaledVector(r,.85-i*.03).add(P(0,.2,0)),l:t.gtr.g.localToWorld(P(.3+Math.sin(i*.4)*.15,0,0)),f:34,hh:.5}},singer:i=>{let e=ec(Wn);return{p:P(.95-i*.05,Ne+.5,e.z+1.9),l:P(e.x,e.y-.2,e.z),f:46,hh:.7}},drums:i=>{let e=ec(jn);return{p:P(-1.7+i*.08,Ne+1.9,-.6),l:P(e.x,e.y-.45,e.z),f:50,hh:.5}},faceoff:i=>({p:P(Math.sin(i*.3)*.4,Ne+.95,4.3-i*.12),l:P(0,Ne+1.35,.6),f:60,hh:.5}),side:(i,e)=>{let t=e.who===0?-1:1;return{p:P(t*7.6,Ne+1.45,1.4+i*.05),l:P(0,Ne+1.3,.7),f:40,hh:.5}},crane:i=>{let e=i*.11+.5;return{p:P(Math.sin(e)*13,5+Math.sin(i*.2)*1.5,Math.cos(e)*13+1),l:P(0,Ne+1.2,-.5),f:42,hh:.2}},track:(i,e)=>{let t=Se(i/7,0,1);return{p:P(Ue(-6,6,t)*e.s,Ne+1.2,4.3),l:P(Ue(-4,4,t)*e.s,Ne+1.3,.5),f:45,hh:.4}}},df={intro:["wide","crane","crowdLow","track","singer","drums"],verse:["duo","close","close","singer","drums","guitar","over","wide","crowdLow","side","track"],pre:["close","hero","guitar","drums","side","crowdLow"],chorus:["close","hero","singer","wide","crowdLow","faceoff","over","crane","guitar"],solo:["hero","close","guitar","faceoff","hero","side","over"],break:["drums","side","crowdLow","hero","guitar"],outro:["hero","close","crane","wide"]},Zv={establish:.3,wide:.3,crowdLow:.3,crane:.3,side:.28,duo:.27,over:.25,drums:.24,close:.22,hero:.22},Jv=["singer","faceoff","track","guitar"],Ki={name:"establish",t0:0,r:{s:1,who:0},nextBar:0,until:0,shake:0,reset(){this.cut("establish",{s:1,who:0}),this.until=Zt.t+9,this.nextBar=3},cut(i,e){this.name=i,this.t0=Zt.t,this.r=e},event(i,e,t){zt.cam==="auto"&&(xi()&&(e=0),i==="attacker"?this.cut("close",{s:1,who:e}):i==="faceoff"?this.cut(ct()<.6?"faceoff":"side",{s:1,who:e}):i==="target"?this.cut(ct()<.5?"close":"hero",{s:1,who:e}):i==="winner"&&this.cut("hero",{s:1,who:e}),this.until=Zt.t+t)},onBar(i,e){if(zt.cam!=="auto"||Zt.t<this.until||i<this.nextBar)return;let t=df[e.name]||df.verse;xi()&&(t=t.filter(s=>!Jv.includes(s)));let n;do n=Gn(t);while(n===this.name&&t.length>1);let r=_t.mom>0?0:1,a=xi()?0:ct()<.6+Math.abs(_t.mom)*.3?r:1-r;_t.ko&&(n=Gn(["hero","close","crane","wide","crowdLow"])),this.cut(n,{s:ct()<.5?1:-1,who:_t.ko?_t.winner:a}),this.nextBar=i+(au[e.name]>.9?1+(ct()<.5?1:0):2)},update(i,e){let t=this.name,n=this.r;if(zt.cam!=="auto"){let[s,o]=zt.cam.split(":");t=s,n={s:1,who:+(o||0)},this.fixedName!==zt.cam&&(this.fixedName=zt.cam,this.t0=i)}let r=Yv[t](i-this.t0,n);this.shake=Math.max(0,this.shake-e*2);let a=(r.hh??.5)*.025;r.p.x+=(Math.sin(i*1.3)+Math.sin(i*2.9)*.5)*a+(ct()-.5)*this.shake*.1,r.p.y+=(Math.sin(i*1.7+1)+Math.sin(i*3.3)*.4)*a+(ct()-.5)*this.shake*.1,Lt.position.copy(r.p),Lt.lookAt(r.l),Lt.fov!==r.f&&(Lt.fov=r.f,Lt.updateProjectionMatrix()),xi()&&fs?Lt.setViewOffset(fs,fo,Math.round(fs*(Zv[t]??.27)),0,fs,fo):Lt.view?.enabled&&!j.open&&Lt.clearViewOffset(),Ni.u.uScale.value=fo*si.getPixelRatio()/(2*Math.tan(dh.degToRad(Lt.fov)/2))}},$i={cur:null,vs(i,e){this.cur={type:"vs",t0:Zt.t,a:fi[i],b:fi[e]}},call(i,e){this.cur={type:"call",t0:Zt.t,text:i,color:e}},ko(i){this.cur={type:"ko",t0:Zt.t,w:fi[i]}},solo(i){this.cur={type:"solo",t0:Zt.t,a:fi[i]}},fin(i,e){this.cur={type:"fin",t0:Zt.t,text:i,w:fi[e]}}},lo=0;tu="";fs=0,fo=0,j={open:!1,L:null,key:null,rk:null,tab:"cuerpo",view:"cuerpo",yaw:.35,zoom:1,mt0:0,tm:0,snap:!0,drag:null,cp:P(),cl:P(),tat:{design:null,spot:null,color:1709088}},oc=P(0,Ne,1.2),Qv=[["cuerpo","Cuerpo"],["cara","Cara"],["pelo","Pelo"],["ropa","Ropa"],["guitarra","Guitarra"],["acc","Accesorios"],["tat","Tatuajes"],["cajas","\u{1F4E6} Cajas"]],ex=[["cuerpo","Cuerpo"],["cara","Cara"],["manos","Manos"],["pies","Pies"]],uc={cuerpo:i=>({l:i.root.position.clone().add(P(0,.92,0)),d:3.9,h:.25,fov:36,yaw:.35}),cara:i=>({l:i.face.localToWorld(P(0,-.025,.05)),d:.85,h:.02,fov:30,yaw:.25}),ojos:i=>({l:i.face.localToWorld(P(0,.012,.09)),d:.5,h:0,fov:28,yaw:.15}),pelo:i=>({l:i.face.localToWorld(P(0,-.07,-.01)),d:1.4,h:.12,fov:32,yaw:.6}),torso:i=>({l:i.torso.localToWorld(P(0,.36,.05)),d:1.7,h:.08,fov:32,yaw:.3}),piernas:i=>({l:i.root.position.clone().add(P(0,.55,.03)),d:2.3,h:.1,fov:34,yaw:.35}),pies:i=>({l:i.root.position.clone().add(P(0,.07,.06)),d:1.5,h:.32,fov:34,yaw:.5}),manos:i=>({l:i.handB[0].getWorldPosition(P()).add(i.handB[1].getWorldPosition(P())).multiplyScalar(.5),d:1,h:.1,fov:32,yaw:.2}),guitarra:i=>({l:i.gtr.g.localToWorld(P(.2,0,0)),d:1.6,h:.1,fov:34,yaw:.15}),caja:()=>cx(),cuello:i=>({l:i.neck.localToWorld(P(0,.01,.03)),d:.7,h:.03,fov:30,yaw:.25}),oreja:i=>{let e=["long","longF"].includes(i.cfg.hair?.style);return{l:i.face.localToWorld(P(e?-.07:-.1,-.045,e?.03:0)),d:e?.8:.65,h:0,fov:30,yaw:e?-.55:-1.25}},muneca:i=>({l:i.fa[1].localToWorld(P(0,-.275,0)),d:.95,h:.12,fov:30,yaw:.25})},pf={cuerpo:"cuerpo",cara:"cara",pelo:"pelo",ropa:"cuerpo",guitarra:"guitarra",acc:"cuello",cajas:"cuerpo"},iu=i=>i==="face.faceShape"||i.startsWith("face.mk")||i==="face.lipColor"||i.startsWith("beard")?"cara":i.startsWith("face.")?"ojos":i.startsWith("hair")?"pelo":i.startsWith("top")?"torso":i.startsWith("bottom")||i==="belt"||i.startsWith("legwear")?"piernas":i.startsWith("shoes")?"pies":i.startsWith("gloves")?"manos":i.startsWith("guitar")?"guitarra":i.startsWith("necklace")?"cuello":i.startsWith("earrings")?"oreja":i.startsWith("bracelets")?"muneca":"cuerpo";gc=i=>j.rk?(uc[i]||uc.cuerpo)(j.rk).yaw:.35,tx={brazoI:["cuerpo",1.25],antebrazoI:["cuerpo",1.25],manoI:["manos",1.3],musloI:["cuerpo",1.1],brazoD:["cuerpo",-1.25],antebrazoD:["cuerpo",-1.25],manoD:["manos",-.9],musloD:["cuerpo",-1.1],espalda:["cuerpo",Math.PI],cuello:["cara",1.1],mejilla:["cara",-.35],pecho:["cuerpo",.2],clavicula:["cuerpo",.3]};ff=0;Mt("#edTabs").onclick=i=>{let e=i.target.closest("button");if(!e)return;let t=j.tab;j.tab=e.dataset.tab,Xn(),Mt("#edPane").scrollTop=0,j.tab==="tat"?nu(j.tat.spot):va(pf[j.tab],gc(pf[j.tab])),t==="tat"!=(j.tab==="tat")&&j.tat.spot==="mejilla"?dn(!1):vc()};Mt("#edViews").onclick=i=>{let e=i.target.closest("button");e&&(e.dataset.rot?j.yaw+=+e.dataset.rot*.6:va(e.dataset.view,gc(e.dataset.view)),Xn())};Mt("#edPane").onclick=i=>{let e=i.target.closest("button");if(!e)return;let t=e.dataset;if(e.classList.contains("lock")){zi("\u{1F512} A\xFAn no la tienes: \xE1brela en las cajas");return}if(t.var){let r=bf(j.L.body,t.var,j.L[t.var].type)[+t.i];if(r?.venta){zi("\u{1F3EA} Est\xE1 a la venta: ret\xEDrala en el mercado para usarla");return}r&&(Object.assign(j.L[t.var],r.c),va(iu(t.var+".type")),dn());return}if(t.box){qf();return}if(t.mercado){bs.mercado?.();return}if(t.vende){ax(t.vende,e);return}if(t.lasti!==void 0){let r=ai.last[+t.lasti];r&&jf(r);return}if(t.base){let r=t.base,a=j.L.name;j.L=Eh(_r(fi[r]),ai.own.filter(s=>s.copia&&!s.venta)),j.L.name=a,dn();return}if(t.blank){let r=j.L.name;j.L=An(j.L.body),j.L.name=r,dn();return}if(t.tatdel!==void 0){j.L.tattoos.splice(+t.tatdel,1),dn();return}if(t.tatadd){j.L.tattoos.length<5&&(j.L.tattoos.push({design:j.tat.design,spot:j.tat.spot,color:j.tat.color}),nu(j.tat.spot),dn());return}if(t.tp){let r=j.tat.spot==="mejilla";if(j.tat[t.tp]=t.tp==="color"?+t.c:t.v,t.tp==="design"){let a=Nn[j.L.body].tatDesign.find(s=>s[0]===t.v);a?.[2]&&(j.tat.color=a[2].color,zi("\u2605 \xA1Tatuaje legendario!"))}t.tp==="spot"&&nu(t.v),Xn(),r||j.tat.spot==="mejilla"?dn(!1):vc();return}let n=t.p;if(n){if(n==="body"){t.v!==j.L.body&&nx(t.v);return}va(iu(n)),Wf(n,t.v!==void 0?t.v:n==="ui"?t.c:+t.c)}};Mt("#edPane").onchange=i=>{let e=i.target;if(e.type==="color"&&!(!e.dataset.p&&!e.dataset.tp)){if(e.dataset.tp){j.tat.color=parseInt(e.value.slice(1),16),Xn(),j.tat.spot==="mejilla"?dn(!1):vc();return}Wf(e.dataset.p,e.dataset.p==="ui"?e.value:parseInt(e.value.slice(1),16))}};Mt("#edName").oninput=i=>{j.L.name=i.target.value};Mt("#edRand").onclick=()=>{let i=j.L.name;j.L=O1(Op(j.L.body,ct)),j.L.name=i,dn()};Mt("#edSave").onclick=rx;Mt("#edClose").onclick=ox;Hi.addEventListener("pointerdown",i=>{Ct.on&&!Ct.open&&Ct.t>.95&&(Ct.skip=Ct.t),j.open&&(j.drag={x:i.clientX,yaw:j.yaw},Hi.setPointerCapture(i.pointerId))});Hi.addEventListener("pointermove",i=>{j.drag&&(j.yaw=j.drag.yaw-(i.clientX-j.drag.x)*.012)});Hi.addEventListener("pointerup",()=>{j.drag=null});Hi.addEventListener("pointercancel",()=>{j.drag=null});Ct={on:!1,t:0,res:null,parts:null,open:!1,shown:!1,skip:null,shake:0,closeT:-1,camY:0,landed:!1},Xf=oc.clone().add(P(.85,0,.8)),Li=.5,gi=.38,mi=.5,cx=()=>({l:Xf.clone().add(P(-.12,.45+Ct.camY,0)),d:3.3,h:.75-Ct.camY,fov:34,yaw:-.38});Mt("#boxUI").onclick=i=>{let e=i.target.closest("button");if(!e||!Ct.on)return;let t=e.dataset.act;if(t==="equip"){let n=Ct.res.v;cc(),jf(n),zi("\xA1Equipado!")}else t==="again"?(cc(!0),qf()):cc()};Hi.addEventListener("wheel",i=>{j.open&&(i.preventDefault(),j.zoom=Se(j.zoom*Math.exp(i.deltaY*.001),.45,1.8))},{passive:!1});ru=performance.now()/1e3,Ji=0,co=0,Gh=0,mf=0,Zf=!1,gf=new ke,vf=new ke,fx=new ke;pn||(addEventListener("resize",()=>{ga&&xa()}),new ResizeObserver(()=>{ga&&xa()}).observe(Hi));yo=[{escala:.6,fps:30,bloom:!0,sombra:3,publico:160},{escala:.5,fps:30,bloom:!1,sombra:4,publico:120},{escala:.42,fps:24,bloom:!1,sombra:4,publico:90},{escala:.34,fps:15,bloom:!1,sombra:6,publico:60}],Qe={nivel:0,min:0,ema:1/60,malo:0,bueno:0,acum:0,cuadros:0,peor:0,prueba:0,inocente:!1,alDemasiado:null,externo:!1},hu=()=>St.on&&!j.open;ga=!1,Pr=0,bs={},Kf=!pn&&typeof requestAnimationFrame=="function"?requestAnimationFrame:i=>setTimeout(i,16),mx=!pn&&typeof cancelAnimationFrame=="function"?cancelAnimationFrame:clearTimeout;gx=()=>{ru=performance.now()/1e3,Pr||(Pr=Kf($f))},Qf={canvas:Hi,monta(i){i&&i.append(Hi),ga=!0,xa(),gx()},desmonta(){j.open&&lc(),ga=!1,Pr&&mx(Pr),Pr=0,pn||Hi.remove(),St.on=!1},tam(i,e,t){Object.assign(wr,{w:Math.max(2,i|0),h:Math.max(2,e|0),dpr:t||1}),ga&&xa()},oculto(i){wr.oculto=!!i},inventario(i){ai={coins:i.coins|0,parada:!!i.parada,own:[...Xl().map(e=>({...e})),...i.own||[]],opened:i.opened|0,last:i.last||[]},j.open&&!Ct.on&&Xn()},editor(i,e){bs=e||{},St.on=!1,St.alto=!1,_t.t0===void 0&&_t.start(),mo(),sx(i?Eh(_r(i),ai.own.filter(t=>t.copia&&!t.venta)):null)},cierraEditor(){j.open&&lc()},enVivo({yo:i,rival:e=null,alto:t=!1,alDemasiado:n=null}){j.open&&lc();let r=i?.look?_r(i.look):An("m");if(!i?.look&&i?.nombre&&(r.name=String(i.nombre).slice(0,24)),zt.L=hf("yo",r),St.solo=!e,e){let a="u_"+String(e.uid||"rival").replace(/[^\w-]/g,"").slice(0,40),s=e.look?_r(e.look):null;if(!s){let o=["violeta","rex","kid"][[...String(e.uid||"")].reduce((l,c)=>l+c.charCodeAt(0),0)%3];s=_r(fi[o]),s.name=String(e.nombre||s.name).slice(0,24)}zt.Rr=hf(a,s)}Object.assign(St,{on:!0,mt:0,raw:-1,ko:null,fin:null,hype:0,alto:!!t}),zt.bars=!1,zt.cam="auto",Object.assign(Qe,{nivel:t?2:1,min:t?2:0,ema:1/60,malo:0,bueno:0,acum:0,peor:0,prueba:0,inocente:!1,alDemasiado:n,externo:!1}),_t.start(),mo();try{si.compile(Ge,Lt);for(let a=0;a<2;a++)dc(1/30),pc(1/30)}catch(a){console.warn("[rock] precalentar",a)}},get nivel(){return Qe.nivel},_nivel(i){Qe.nivel=Math.max(0,Math.min(yo.length-1,i)),mo()},pulso({beats:i,animo:e=0,hype:t=0,dtJuego:n=0}){if(!St.on)return;n>0&&(Qe.externo=!0,Jf(n));let r=Math.max(0,i)*vi,a=Xv(r);a<St.mt-.05&&_t.rewound(),St.raw=r,St.mt=a,St.hype=Se(t,0,1),_t.momT=Se(e,-.85,.85)},ataque(i){St.on&&!St.solo&&_t.attack(i?1:0,Gn(Object.keys(ho)))},hype(i,e,t){St.on&&St.solo&&_t.hype(i,e,t)},fin(i=0,e=""){St.on&&(St.fin=e||null,St.ko=i?1:0)}};globalThis.__rock={rock:Qf,CAL:Qe,TAM:wr,get montada(){return ga},get raf(){return Pr},battle:_t,director:Ki,ED:j,BOX:Ct,VIVO:St,ROCKERS:fi,rockers:Qi,scene:Ge,camera:Lt,renderer:si,step:dc,render:pc};Mt("#loading")?.remove()});var fn=null,im=[];async function vx(i){globalThis.ROCK_LIENZO=i.canvas;try{fn=(await tm().then(()=>em)).rock,fn.tam(i.w,i.h,i.dpr),postMessage({t:"listo"});for(let t of im.splice(0))nm(t)}catch(e){postMessage({t:"error",m:String(e&&e.message||e)})}}function nm(i){if(!fn){im.push(i);return}switch(i.t){case"tam":fn.tam(i.w,i.h,i.dpr);break;case"oculto":fn.oculto(i.on);break;case"monta":fn.monta(null);break;case"desmonta":fn.desmonta();break;case"vivo":fn.enVivo({yo:i.yo,rival:i.rival,alto:i.alto,alDemasiado:()=>postMessage({t:"demasiado"})});break;case"pulso":fn.pulso(i);break;case"ataque":fn.ataque(i.quien);break;case"hype":fn.hype(i.kind,i.text,i.color);break;case"fin":fn.fin(i.ganador,i.texto);break}}onmessage=i=>{let e=i.data||{};e.t==="lienzo"?vx(e):nm(e)};
