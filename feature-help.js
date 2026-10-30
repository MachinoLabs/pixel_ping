/* On-demand guidance: no automatic popups or changes to QR actions. */
(() => {
 const topics={
  sync:['Sync your account','Sync checks your account access and refreshes your saved codes and live routes.'],
  cleanup:['Keep your workspace tidy','Keep your workspace tidy. Delete test codes and saved designs you no longer need.'],
  mode:['Static or Dynamic?','Static stores the destination directly in the QR. To change it, create and print a new QR. Dynamic stores a permanent route: after activation, you can change its destination in Command Center without replacing the printed QR. Dynamic requires Evolution.'],
  activate:['Save & Activate','Save & Activate makes this Dynamic route work. It does not download a file or save the design to My Codes. Use Download QR for a file, Preview & Print for a preview, and Save to My Codes to keep an editable design.'],
  save:['Save to My Codes','Save a named copy of the content, design and print settings to your account. My Codes holds up to 50 designs shared across devices and keeps them until you delete them. Saving a design does not activate a Dynamic route. Update Saved Code updates the opened design; Save as New keeps a separate design.'],
  preview:['Preview before printing','Click Preview & Print to open your print preview. If your Dynamic QR needs activation, choose Activate & Preview Print to continue. If you edited its destination, choose Save Changes & Preview Print. Opening the preview does not start printing. Review it, then use the preview’s Print button. PDF downloads also use this preview: choose Save as PDF in the print dialog.'],
  duplicate:['Duplicate a saved design','Duplicate opens a copy in Canvas. Save it to My Codes when ready. A Dynamic duplicate gets its own new route and must be activated separately; the original printed QR and its destination stay the same. The duplicate needs a new download and new printed copies; it cannot replace the QR already printed.'],
  delete:['Delete a saved design','Delete Saved Design removes the saved design from My Codes. It does not delete or deactivate its Dynamic route; any active QR keeps working. Manage live routes separately in Command Center.'],
  unavailable:['Route unavailable','Your saved design remains in My Codes. A connection or account problem can prevent a status check; Refresh this page, then click Sync and try again. If needed, sign in again. Check Again can retry the route check. If the route was deleted, it cannot be reactivated. Duplicate the design, activate the new QR, then download it and replace old printed copies.'],
  print:['Smart Print text','The first line becomes the bold, centered business name or headline. Following lines contain your message. Use Enter to start a new paragraph. All text is centered and paragraph breaks are preserved. The 1,024-character counter includes the headline and message.']
 };
 const dialog=document.createElement('dialog');dialog.className='pp-help-dialog';dialog.setAttribute('aria-labelledby','feature-help-title');dialog.setAttribute('aria-describedby','feature-help-message');
 const title=document.createElement('h2');title.id='feature-help-title';const message=document.createElement('p');message.id='feature-help-message';
 const label=document.createElement('label');label.textContent='Design name';label.htmlFor='feature-help-name';
 const input=document.createElement('input');input.id='feature-help-name';input.maxLength=80;
 const error=document.createElement('p');error.setAttribute('role','alert');const actions=document.createElement('div');actions.className='pp-help-actions';
 dialog.append(title,message,label,input,error,actions);document.body.append(dialog);
 let resolve=null;
 function ask({title:heading,message:text,name,choices=[['ok','Got it','ordinary']]}){
  if(dialog.open)return Promise.resolve({action:'cancel'});
  title.textContent=heading;message.textContent=text;label.hidden=input.hidden=name===undefined;input.value=name||'';error.textContent='';actions.replaceChildren();
  return new Promise(done=>{resolve=done;for(const [action,text,tone='neutral']of choices){const b=document.createElement('button');b.type='button';b.textContent=text;b.className='pp-dialog-action pp-dialog-'+tone;b.addEventListener('click',()=>{const value=input.value.trim();if(name!==undefined&&action!=='cancel'&&(!value||value.length>80||/[\u0000-\u001f\u007f]/.test(value))){error.textContent='Enter a name of 1–80 characters without line breaks.';input.focus();return}const complete=resolve;resolve=null;dialog.close();complete?.({action,value})});actions.append(b)}dialog.showModal();if(name!==undefined){input.focus();input.select()}});
 }
 dialog.addEventListener('close',()=>{const done=resolve;resolve=null;done?.({action:'cancel'})});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();actions.firstElementChild?.click()}});
 function bubble(topic,text){const b=document.createElement('button');b.type='button';b.className='pp-help-bubble';b.textContent='ⓘ'+(text?' '+text:'');b.title=topics[topic][0];b.setAttribute('aria-label',topics[topic][0]);b.setAttribute('aria-haspopup','dialog');b.addEventListener('click',()=>ask({title:topics[topic][0],message:topics[topic][1]}));return b}
 window.pixelPingHelp={ask,bubble,topics};
 window.addEventListener('DOMContentLoaded',()=>{
  const $=id=>document.getElementById(id);
  for(const id of ['saved-library-heading','live-routes-heading'])if($(id))$(id).append(bubble('cleanup'));
  if($('recent-heading'))$('recent-heading').insertAdjacentElement('afterend',bubble('cleanup'));
  if($('qr-content-heading'))$('qr-content-heading').append(bubble('mode'));
  if($('dynamic-route-guide'))$('dynamic-route-guide').insertAdjacentElement('afterend',bubble('activate'));
  if($('print-message-help'))$('print-message-help').append(bubble('print'));
  if($('action-row')){const row=document.createElement('div');row.className='pp-help-row';row.append(bubble('save','About saving'),bubble('preview','How to preview'));$('action-row').insertAdjacentElement('afterend',row)}
  if($('btn-refresh-data'))$('btn-refresh-data').insertAdjacentElement('afterend',bubble('sync','About Sync'));
 });
})();
