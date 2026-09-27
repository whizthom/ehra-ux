import {useEffect, useState} from "react";
import s from "../../RetailWorkspace.module.css";
import {addPurchasePayment} from "../../../api/retailApi";
import {Modal, Empty, Panel, Toolbar, PaymentHistory} from "./shared";
import {PaymentModal} from "./modals";

function Suppliers({items,purchases,onAdd,onEdit,onPurchase,onDelete,money,onReversePurchase,canFinance=false}){
  const [payPurchase,setPayPurchase]=useState(null);
  const [historyPurchase,setHistoryPurchase]=useState(null);
  return <>
    <Toolbar title="Suppliers & purchases" sub="Manage supplier relationships, incoming stock and amounts payable."
      action={<div className={s.toolbarRight}>
        <button className={s.outline} onClick={onPurchase}>＋ Record Purchase</button>
        <button className={s.primary} onClick={onAdd}>＋ Add Supplier</button>
      </div>}/>
    <Panel title={`${items.length} suppliers`} sub="Supplier information remains private to your business.">
      <div className={s.supplierGrid}>
        {items.map(x=><div className={s.supplier} key={x.id}>
          <div><b>{x.name}</b><small>{x.phone||x.email||"No contact details"}</small><small>Outstanding: {money(x.outstanding)}</small></div>
          <div><button className={s.textButton} onClick={()=>onEdit(x)}>Edit</button><button className={s.textDanger} onClick={()=>onDelete(x.id)}>Deactivate</button></div>
        </div>)}
      </div>
      {!items.length&&<Empty title="No suppliers yet" text="Add your suppliers so purchases and payables stay organised." action={<button className={s.primary} onClick={onAdd}>Add supplier</button>}/>} 
    </Panel>
    <Panel title="Purchase history" sub="Recent stock purchases and outstanding supplier balances.">
      <div className={s.tableWrap}>
        <table><thead><tr><th>Purchase</th><th>Supplier</th><th>Date</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Payment</th></tr></thead>
        <tbody>{(purchases||[]).slice(0,30).map(x=><tr key={x.id}>
          <td><b>{x.purchaseNumber}</b>{x.status==="REVERSED"&&<small>Reversed</small>}</td>
          <td>{x.supplierName||"Unassigned"}</td><td>{x.purchaseDate}</td><td>{money(x.total)}</td><td>{money(x.paid)}</td><td>{money(x.outstanding)}</td>
          <td>{x.status!=="REVERSED"&&<>
            <button className={s.textButton} onClick={()=>setHistoryPurchase(x)}>History</button>
            <button className={s.textButton} onClick={()=>setPayPurchase(x)} disabled={Number(x.outstanding||0)<=0}>Pay</button>
            {onReversePurchase&&<button className={s.textDanger} disabled={Number(x.paid||0)>0} title={Number(x.paid||0)>0?"Paid purchases must be reconciled with the supplier before reversal.":"Reverse purchase"} onClick={()=>onReversePurchase(x.id)}>Reverse</button>}
          </>}</td>
        </tr>)}</tbody></table>
        {!(purchases||[]).length&&<Empty title="No purchases yet" text="Record a purchase to increase inventory and track supplier payables."/>}
      </div>
    </Panel>
    {historyPurchase&&<Modal title={`Payment history ${historyPurchase.purchaseNumber}`} onClose={()=>setHistoryPurchase(null)}><PaymentHistory kind="purchase" id={historyPurchase.id} money={money} canFinance={canFinance}/></Modal>}
    {payPurchase&&<PaymentModal title="Pay supplier" max={Number(payPurchase.outstanding||0)} onClose={()=>setPayPurchase(null)} onSave={async d=>{await addPurchasePayment(payPurchase.id,d);setPayPurchase(null);window.location.reload()}}/>}
  </>;
}

export {Suppliers};
