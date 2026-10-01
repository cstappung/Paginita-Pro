(()=>{
  'use strict';
  const {catalog,normalize,draw}=BBTANCharacter;
  const $=id=>document.getElementById(id), key='bbtan-character-v1';
  let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  let appearance=normalize(saved), category='hair';
  const palette=['#352a3e','#f1f0e9','#c4f568','#b7a1f7','#77d9d2','#ffa675','#ef7795','#e75757','#547adc','#39875b','#b07748','#f2ce59'];
  function save(){try{localStorage.setItem(key,JSON.stringify(appearance));$('appearance-status').textContent='Guardado en este navegador.';}catch{$('appearance-status').textContent='Cambios disponibles durante esta sesión.';}}
  function paint(canvas,a,part){
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!part)draw(ctx,a,210,435,3.5);
    else if(part==='hair')draw(ctx,a,66,245,2.3);
    else if(part==='eyes'||part==='mouth')draw(ctx,a,66,275,3);
    else if(part==='shirt')draw(ctx,a,66,210,3.3);
    else if(part==='pants')draw(ctx,a,66,135,3.6);
    else draw(ctx,a,66,89,3.2);
  }
  function refresh(){
    paint($('character-preview'),appearance);
    $('skin-color').value=appearance.colors.skin;$('item-color').value=appearance.colors[category];$('color-value').textContent=appearance.colors[category].toUpperCase();
    document.querySelectorAll('.style-choice').forEach((button,i)=>{button.setAttribute('aria-pressed',String(appearance[category]===i));paint(button.querySelector('canvas'),{...appearance,[category]:i},category);});
    document.querySelectorAll('.color-swatches button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.color===appearance.colors[category])));
  }
  function selectCategory(part){
    category=part;
    document.querySelectorAll('[role=tab]').forEach(button=>{const active=button.dataset.part===part;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    $('category-title').textContent=catalog[part].label;$('option-count').textContent=`${catalog[part].names.length} estilos`;$('color-label').textContent=catalog[part].colorLabel;$('item-color').setAttribute('aria-label',catalog[part].colorLabel);$('style-panel').setAttribute('aria-labelledby',`tab-${part}`);
    $('style-options').replaceChildren();
    catalog[part].names.forEach((name,i)=>{
      const button=document.createElement('button');button.type='button';button.className='style-choice';button.setAttribute('aria-label',`${catalog[part].label}: ${name}`);
      const canvas=document.createElement('canvas');canvas.width=132;canvas.height=132;canvas.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=name;button.append(canvas,label);
      button.addEventListener('click',()=>{appearance[part]=i;save();refresh();});$('style-options').append(button);
    });refresh();
  }
  Object.entries(catalog).forEach(([part,item])=>{
    const button=document.createElement('button');button.id=`tab-${part}`;button.dataset.part=part;button.setAttribute('role','tab');button.setAttribute('aria-controls','style-panel');button.textContent=item.label;
    button.addEventListener('click',()=>selectCategory(part));
    button.addEventListener('keydown',event=>{const keys=Object.keys(catalog),i=keys.indexOf(part);let next;
      if(event.key==='ArrowRight')next=keys[(i+1)%keys.length];if(event.key==='ArrowLeft')next=keys[(i+keys.length-1)%keys.length];if(event.key==='Home')next=keys[0];if(event.key==='End')next=keys[keys.length-1];
      if(next){event.preventDefault();selectCategory(next);$(`tab-${next}`).focus();}
    });$('category-tabs').append(button);
  });
  palette.forEach(color=>{const button=document.createElement('button');button.style.backgroundColor=color;button.dataset.color=color;button.setAttribute('aria-label',`Usar color ${color}`);button.addEventListener('click',()=>{appearance.colors[category]=color;save();refresh();});$('color-swatches').append(button);});
  $('item-color').addEventListener('input',event=>{appearance.colors[category]=event.target.value;save();refresh();});
  $('skin-color').addEventListener('input',event=>{appearance.colors.skin=event.target.value;save();refresh();});
  window.BBTANAppearance={get:()=>appearance,refresh};selectCategory(category);
})();
