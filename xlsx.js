"use strict";

// Small, self-contained OOXML writer for the static preview's Excel export.
(() => {
  const encoder = new TextEncoder();
  const xml = value => String(value ?? "").replace(/[&<>"']/g, character =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"})[character]);
  const crcTable = Array.from({length:256},(_,index) => {
    let value=index;
    for(let bit=0;bit<8;bit++) value=(value&1) ? (0xedb88320^(value>>>1)) : (value>>>1);
    return value>>>0;
  });
  const crc32 = bytes => {
    let value=0xffffffff;
    for(const byte of bytes) value=crcTable[(value^byte)&255]^(value>>>8);
    return (value^0xffffffff)>>>0;
  };
  const zip = files => {
    const parts=[], directory=[];
    let offset=0;
    const u16=(view,at,value)=>view.setUint16(at,value,true);
    const u32=(view,at,value)=>view.setUint32(at,value,true);
    for(const [name,content] of files) {
      const filename=encoder.encode(name), bytes=encoder.encode(content), crc=crc32(bytes);
      const local=new Uint8Array(30+filename.length), view=new DataView(local.buffer);
      u32(view,0,0x04034b50);u16(view,4,20);u16(view,6,0);u16(view,8,0);
      u32(view,14,crc);u32(view,18,bytes.length);u32(view,22,bytes.length);
      u16(view,26,filename.length);local.set(filename,30);
      parts.push(local,bytes);
      const central=new Uint8Array(46+filename.length), cv=new DataView(central.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u32(cv,16,crc);
      u32(cv,20,bytes.length);u32(cv,24,bytes.length);u16(cv,28,filename.length);
      u32(cv,42,offset);central.set(filename,46);directory.push(central);
      offset+=local.length+bytes.length;
    }
    const directorySize=directory.reduce((sum,part)=>sum+part.length,0);
    const end=new Uint8Array(22), ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,8,files.length);u16(ev,10,files.length);
    u32(ev,12,directorySize);u32(ev,16,offset);
    return new Blob([...parts,...directory,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  };
  const color = value => {
    const match=String(value || "").match(/^#([0-9a-f]{6})$/i);
    return match ? "FF"+match[1].toUpperCase() : null;
  };
  const columnName = index => {
    let label="";
    for(let n=index+1;n;n=Math.floor((n-1)/26)) label=String.fromCharCode(65+(n-1)%26)+label;
    return label;
  };
  window.previewXlsx = ({headers=[],rows=[],rowMeta=[]}) => {
    const styles=new Map(), fonts=['<font><sz val="11"/><color rgb="FF202020"/><name val="Arial"/></font>'];
    const fills=['<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>'];
    const cellXfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const getStyle=(background,foreground,bold,strike) => {
      const signature=JSON.stringify([background,foreground,!!bold,!!strike]);
      if(styles.has(signature)) return styles.get(signature);
      const fg=color(foreground), bg=color(background);
      const fontId=fonts.length;
      fonts.push('<font><sz val="11"/>'+(bold?'<b/>':'')+(strike?'<strike/>':'')+
        (fg?'<color rgb="'+fg+'"/>':'<color rgb="FF202020"/>')+'<name val="Arial"/></font>');
      let fillId=0;
      if(bg) {fillId=fills.length;fills.push('<fill><patternFill patternType="solid"><fgColor rgb="'+bg+'"/><bgColor indexed="64"/></patternFill></fill>');}
      const styleId=cellXfs.length;
      cellXfs.push('<xf numFmtId="0" fontId="'+fontId+'" fillId="'+fillId+'" borderId="0" xfId="0" applyFont="1" applyFill="1"/>');
      styles.set(signature,styleId);
      return styleId;
    };
    const headerStyle=getStyle("#D0CECE","#000000",true,false);
    const cell=(value,row,column,style=0)=>'<c r="'+columnName(column)+(row+1)+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
    const lines=[headers.map((value,index)=>cell(value,0,index,headerStyle)).join("")];
    rows.forEach((row,index)=>{
      const meta=rowMeta[index] || {};
      lines.push(row.map((value,column)=>cell(value,index+1,column,
        meta.kind==="weekend" ? 0 : getStyle(meta.cellColors?.[column],meta.textColors?.[column],
          meta.boldCells?.[column],meta.strikeCells?.[column]))).join(""));
    });
    const worksheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
      lines.map((line,index)=>'<row r="'+(index+1)+'">'+line+'</row>').join("")+
      '</sheetData></worksheet>';
    const styleXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<fonts count="'+fonts.length+'">'+fonts.join("")+'</fonts><fills count="'+fills.length+'">'+fills.join("")+'</fills>'+
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
      '<cellXfs count="'+cellXfs.length+'">'+cellXfs.join("")+'</cellXfs></styleSheet>';
    return zip([
      ["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="排期" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ["xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml",styleXml],["xl/worksheets/sheet1.xml",worksheet]
    ]);
  };
})();
