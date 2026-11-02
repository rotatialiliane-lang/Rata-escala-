package br.com.wvs.corte;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;

/** WVS Corte - versão experimental. Comunicação USB ZPL, requer validação na L42 real. */
public class MainActivity extends Activity {
    private static final String USB_ACTION = "br.com.wvs.corte.USB_PERMISSION";
    private static final int SELECT_PDFS = 1001;
    private static final int EXPORT_FILE = 1002;
    private WebView web;
    private UsbManager usb;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] exportBytes;
    private String exportMime;
    private String exportFilename;
    private ByteArrayOutputStream exportAccum;
    private PrintJob waiting;

    private static class PrintJob {
        String base64,id;
        int wmm,hmm,vid,pid;
        PrintJob(String b,String i,int w,int h,int v,int p){base64=b;id=i;wmm=w;hmm=h;vid=v;pid=p;}
    }

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        usb=(UsbManager)getSystemService(Context.USB_SERVICE);
        web=new WebView(this);
        setContentView(web);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        web.addJavascriptInterface(new Bridge(),"AndroidBridge");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){
                String host=request.getUrl().getHost();
                return host==null || !"wvs.corte.local".equals(host);
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                try{Intent intent=params.createIntent();startActivityForResult(intent,SELECT_PDFS);return true;}
                catch(Exception ex){fileCallback=null;Toast.makeText(MainActivity.this,"Falha ao escolher arquivo",Toast.LENGTH_LONG).show();return false;}
            }
        });
        IntentFilter f=new IntentFilter(USB_ACTION);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(usbReceiver,f,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(usbReceiver,f);
        try(InputStream input=getAssets().open("index.html")){
            String html=new String(readAll(input),StandardCharsets.UTF_8);
            // Origin estável para localStorage/IndexedDB. Imagens e dados já estão embutidos no HTML.
            web.loadDataWithBaseURL("https://wvs.corte.local/",html,"text/html","UTF-8",null);
        }catch(Exception ex){Toast.makeText(this,"Erro ao abrir WVS Corte: "+ex.getMessage(),Toast.LENGTH_LONG).show();}
    }
    private static byte[] readAll(InputStream in)throws Exception{
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;
        while((n=in.read(b))!=-1)out.write(b,0,n);
        return out.toByteArray();
    }
    private UsbDevice findDevice(int vid,int pid){
        for(UsbDevice d:usb.getDeviceList().values())if(d.getVendorId()==vid&&d.getProductId()==pid)return d;
        return null;
    }
    private final BroadcastReceiver usbReceiver=new BroadcastReceiver(){
        @Override public void onReceive(Context context,Intent intent){
            if(!USB_ACTION.equals(intent.getAction()))return;
            if(waiting==null)return;
            PrintJob j=waiting;waiting=null;
            if(intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED,false))doPrint(j);
            else result(j.id,false,"Permissão USB negada pelo Android");
        }
    };
    private void result(String id,boolean ok,String info){
        runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.onNativePrintResult("+JSONObject.quote(id)+","+ok+","+JSONObject.quote(info)+")",null);});
    }
    private void doPrint(PrintJob job){new Thread(()->{
        UsbDevice device=findDevice(job.vid,job.pid);
        if(device==null){result(job.id,false,"Impressora USB desconectada");return;}
        UsbInterface inf=null;UsbEndpoint end=null;
        for(int i=0;i<device.getInterfaceCount()&&inf==null;i++){
            UsbInterface x=device.getInterface(i);
            for(int e=0;e<x.getEndpointCount();e++){
                UsbEndpoint y=x.getEndpoint(e);
                if(y.getType()==UsbConstants.USB_ENDPOINT_XFER_BULK&&y.getDirection()==UsbConstants.USB_DIR_OUT){inf=x;end=y;break;}
            }
        }
        if(inf==null||end==null){result(job.id,false,"Nenhum endpoint USB de escrita encontrado");return;}
        UsbDeviceConnection conn=usb.openDevice(device);
        if(conn==null){result(job.id,false,"Não foi possível abrir a conexão USB");return;}
        try{
            if(!conn.claimInterface(inf,true))throw new Exception("Interface USB ocupada");
            byte[] zpl=labelToZpl(job.base64,job.wmm,job.hmm);
            int position=0;
            while(position<zpl.length){int amount=Math.min(4096,zpl.length-position);
                int sent=conn.bulkTransfer(end,zpl,position,amount,5000);
                if(sent<=0)throw new Exception("Falha no envio USB (enviados "+position+" de "+zpl.length+" bytes)");
                position+=sent;
            }
            result(job.id,true,"Transferência USB concluída ("+position+" bytes). Confira saída física e QR Code.");
        }catch(Exception ex){result(job.id,false,ex.getMessage());}
        finally{try{conn.releaseInterface(inf);}catch(Exception ignored){}conn.close();}
    },"wvs-usb-printer").start();}
    /**
     * Renderiza a imagem de etiqueta na pagina fisica de 100x50mm (203dpi).
     * Recuo de seguranca: cerca de 4mm nas laterais e 2mm em cima/baixo.
     * Preserva proporcoes do QR code e layout, e explicita uma unica copia.
     * OBS: pulos de etiquetas ainda exigem calibracao GAP na impressora.
     */
    private static byte[] labelToZpl(String base64Data,int wmm,int hmm)throws Exception{
        String encoded=base64Data.contains(",")?base64Data.substring(base64Data.indexOf(',')+1):base64Data;
        byte[] bytes=Base64.decode(encoded,Base64.DEFAULT);
        Bitmap raw=BitmapFactory.decodeByteArray(bytes,0,bytes.length);
        if(raw==null)throw new Exception("Imagem de etiqueta invalida");
        final int dpi=203;
        int labelWidth=Math.max(8,Math.min(864,(int)Math.round(wmm*dpi/25.4)));
        int labelHeight=Math.max(8,Math.min(1600,(int)Math.round(hmm*dpi/25.4)));
        labelWidth=((labelWidth+7)/8)*8;
        int safeX=Math.max(8,(int)Math.round(3*dpi/25.4));
        int safeY=Math.max(8,(int)Math.round(2*dpi/25.4));
        int maxW=Math.max(8,labelWidth-safeX*2);
        int maxH=Math.max(8,labelHeight-safeY*2);
        double scale=Math.min(maxW/(double)raw.getWidth(),maxH/(double)raw.getHeight());
        int printWidth=Math.max(8,Math.min(maxW,((int)Math.floor(raw.getWidth()*scale)/8)*8));
        int printHeight=Math.max(1,Math.min(maxH,(int)Math.round(raw.getHeight()*scale)));
        int offX=(labelWidth-printWidth)/2;
        int offY=(labelHeight-printHeight)/2;
        Bitmap scaled=Bitmap.createScaledBitmap(raw,printWidth,printHeight,true);
        int row=printWidth/8,total=row*printHeight;
        StringBuilder zpl=new StringBuilder(total*2+200);
        zpl.append("^XA\n^PW").append(labelWidth).append("\n^LL").append(labelHeight)
           .append("\n^LH0,0\n^LS0\n^LT0\n^FO").append(offX).append(',').append(offY)
           .append("^GFA,").append(total).append(',').append(total).append(',').append(row).append(',');
        final char[] hex="0123456789ABCDEF".toCharArray();
        for(int y=0;y<printHeight;y++)for(int col=0;col<row;col++){
            int packed=0;
            for(int bit=0;bit<8;bit++){
                int px=scaled.getPixel(col*8+bit,y);
                int luminance=(Color.red(px)*299+Color.green(px)*587+Color.blue(px)*114)/1000;
                if(Color.alpha(px)>120&&luminance<165)packed|=1<<(7-bit);
            }
            zpl.append(hex[(packed>>>4)&15]).append(hex[packed&15]);
        }
        zpl.append("^FS\n^PQ1\n^XZ\n");
        raw.recycle();scaled.recycle();
        return zpl.toString().getBytes(StandardCharsets.US_ASCII);
    }
    public class Bridge{
        @JavascriptInterface public String listUsbDevices(){
            JSONArray arr=new JSONArray();
            for(UsbDevice d:usb.getDeviceList().values()){
                JSONObject o=new JSONObject();
                try{o.put("name",d.getDeviceName());o.put("vid",d.getVendorId());o.put("pid",d.getProductId());arr.put(o);}catch(Exception ignored){}
            }
            return arr.toString();
        }
        @JavascriptInterface public void printLabel(String data,String id,int wmm,int hmm,int vid,int pid){
            if(wmm!=100||hmm!=50){result(id,false,"Esta versão foi preparada apenas para etiqueta 100 x 50 mm");return;}
            PrintJob job=new PrintJob(data,id,wmm,hmm,vid,pid);
            runOnUiThread(()->{
                UsbDevice device=findDevice(vid,pid);
                if(device==null){result(id,false,"Dispositivo USB não encontrado. Conecte o adaptador OTG.");return;}
                if(!usb.hasPermission(device)){
                    if(waiting!=null){result(id,false,"Já existe uma impressão aguardando autorização USB");return;}
                    waiting=job;
                    Intent i=new Intent(USB_ACTION).setPackage(getPackageName());
                    PendingIntent pi=PendingIntent.getBroadcast(MainActivity.this,0,i,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));
                    usb.requestPermission(device,pi);
                }else doPrint(job);
            });
        }
        @JavascriptInterface public synchronized void beginExport(String filename,String mime){
            exportAccum=new ByteArrayOutputStream();exportMime=mime;exportFilename=filename;
        }
        @JavascriptInterface public synchronized void appendExportChunk(String chunk){
            if(exportAccum==null)throw new IllegalStateException("Exportação não iniciada");
            byte[] bytes=Base64.decode(chunk,Base64.DEFAULT);
            exportAccum.write(bytes,0,bytes.length);
        }
        @JavascriptInterface public synchronized void finishExport(){
            if(exportAccum==null)return;
            exportBytes=exportAccum.toByteArray();exportAccum=null;
            runOnUiThread(()->{
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(exportMime==null||exportMime.isEmpty()?"application/octet-stream":exportMime);
                intent.putExtra(Intent.EXTRA_TITLE,exportFilename==null?"wvs_backup.json":exportFilename);
                startActivityForResult(intent,EXPORT_FILE);
            });
        }
        @JavascriptInterface public void saveBase64(String filename,String mime,String b64){
            try{
                byte[] bytes=Base64.decode(b64,Base64.DEFAULT);
                runOnUiThread(()->{
                    exportBytes=bytes;exportMime=mime;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime==null||mime.isEmpty()?"application/octet-stream":mime);
                    intent.putExtra(Intent.EXTRA_TITLE,filename);
                    startActivityForResult(intent,EXPORT_FILE);
                });
            }catch(Exception e){result("export",false,"Erro ao exportar: "+e.getMessage());}
        }
    }
    @Override protected void onActivityResult(int req,int res,Intent data){
        super.onActivityResult(req,res,data);
        if(req==SELECT_PDFS){
            if(fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res,data));fileCallback=null;}
        }else if(req==EXPORT_FILE&&res==RESULT_OK&&data!=null&&data.getData()!=null&&exportBytes!=null){
            try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(exportBytes);Toast.makeText(this,"Arquivo exportado",Toast.LENGTH_SHORT).show();}
            catch(Exception e){Toast.makeText(this,"Não foi possível salvar arquivo: "+e.getMessage(),Toast.LENGTH_LONG).show();}
            finally{exportBytes=null;}
        }
    }
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){try{unregisterReceiver(usbReceiver);}catch(Exception ignored){}if(web!=null)web.destroy();super.onDestroy();}
}