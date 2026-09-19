/** Progressive tabs: SSR keeps every panel readable; JS adds roving focus. */
export function mountTabs(root:HTMLElement, onSelect?:(index:number)=>void):()=>void {
  const list=root.querySelector<HTMLElement>('[role="tablist"]');
  const tabs=[...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  if(!list||!tabs.length)return()=>{};
  const abort=new AbortController();
  const select=(index:number,focus=false)=>{
    tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;
      const id=tab.getAttribute('aria-controls');const panel=id?document.getElementById(id):null;if(panel&&root.contains(panel))panel.hidden=i!==index;});
    root.dataset.selection=String(index);onSelect?.(index);if(focus)tabs[index].focus();
  };
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(index),{signal:abort.signal});
    tab.addEventListener('keydown',e=>{let next=index;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();select(next,true);},{signal:abort.signal});
  });
  list.hidden=false;select(0);
  const dispose=()=>abort.abort();
  window.addEventListener('pagehide',e=>{if(!e.persisted)dispose();},{signal:abort.signal});
  document.addEventListener('astro:before-swap',dispose,{once:true,signal:abort.signal});
  return dispose;
}
