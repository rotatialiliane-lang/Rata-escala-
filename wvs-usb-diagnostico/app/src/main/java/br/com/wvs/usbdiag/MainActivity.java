package br.com.wvs.usbdiag;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Diagnóstico isolado: não modifica projetos do aplicativo WVS Corte. */
public class MainActivity extends Activity {
    private static final String USB_ACTION="br.com.wvs.usbdiag.USB_PERMISSION";
    private UsbManager manager;
    private Spinner spinner;
    private TextView log;
    private final List<UsbDevice> devices=new ArrayList<>();
    private UsbDevice pendingDevice;
    private byte[] pendingBytes;
    private String pendingLanguage;

    private static final String ZPL="^XA\n^PW800\n^LL400\n^LH0,0\n^FO40,50^A0N,45,45^FDWVS USB TESTE ZPL^FS\n^FO40,140^A0N,28,28^FD100 x 50 mm^FS\n^FO40,225^GB650,3,3^FS\n^PQ1\n^XZ\n";
    private static final String EPL="N\nq800\nQ400,24\nA30,30,0,4,1,1,N,\"WVS TESTE EPL\"\nA30,100,0,3,1,1,N,\"100 x 50 mm\"\nP1\n";

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        manager=(UsbManager)getSystemService(Context.USB_SERVICE);
        ScrollView scroll=new ScrollView(this);
        LinearLayout col=new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(28,28,28,40);
        col.setBackgroundColor(Color.rgb(245,249,249));
        scroll.addView(col);
        setContentView(scroll);
        TextView title=new TextView(this);title.setText("WVS • Diagnóstico USB");title.setTextSize(24);title.setTextColor(Color.rgb(15,55,61));title.setPadding(0,0,0,14);col.addView(title);
        TextView info=new TextView(this);info.setText("Teste isolado da Elgin L42 Pro Full. Não altera clientes, chapas ou cortes do WVS Corte.\n\nCom a impressora pronta e etiqueta instalada, selecione VID 8401 PID 1792. A transferência USB não comprova impressão física.");info.setTextSize(15);info.setPadding(0,0,0,20);col.addView(info);
        spinner=new Spinner(this);col.addView(spinner);
        Button locate=button("1. Localizar USB",col);locate.setOnClickListener(v->refresh());
        Button zpl=button("2. Imprimir texto simples ZPL",col);zpl.setOnClickListener(v->request(ZPL,"ZPL"));
        Button epl=button("3. Testar texto EPL (somente se ZPL não imprimiu)",col);epl.setOnClickListener(v->request(EPL,"EPL"));
        TextView warning=new TextView(this);warning.setText("ATENÇÃO: espere o resultado do primeiro teste antes de tocar novamente. Cada comando pode consumir uma etiqueta. Não selecione o adaptador Ethernet do hub.");warning.setPadding(0,14,0,14);col.addView(warning);
        log=new TextView(this);log.setTextSize(14);log.setTextIsSelectable(true);col.addView(log);
        IntentFilter f=new IntentFilter(USB_ACTION);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,f,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver,f);
        refresh();
    }
    private Button button(String label,LinearLayout col){Button b=new Button(this);b.setText(label);b.setAllCaps(false);col.addView(b);return b;}
    private void message(String s){runOnUiThread(()->log.setText(s+"\n\n"+log.getText()));}
    private void refresh(){
        devices.clear();devices.addAll(manager.getDeviceList().values());
        ArrayList<String> opts=new ArrayList<>();
        int preferred=0;
        for(int i=0;i<devices.size();i++){
            UsbDevice d=devices.get(i);
            opts.add("VID "+d.getVendorId()+" PID "+d.getProductId()+" — "+d.getDeviceName());
            if(d.getVendorId()==8401 && d.getProductId()==1792)preferred=i;
        }
        if(opts.isEmpty())opts.add("Nenhum dispositivo USB encontrado");
        ArrayAdapter<String> a=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,opts);
        a.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(a);spinner.setSelection(preferred);
        message("Dispositivos encontrados: "+devices.size()+". Selecione VID 8401 / PID 1792.");
    }
    private void request(String command,String language){
        int n=spinner.getSelectedItemPosition();
        if(n<0||n>=devices.size()){message("Nenhuma impressora selecionada.");return;}
        UsbDevice device=devices.get(n);
        if(device.getVendorId()!=8401||device.getProductId()!=1792){message("Dispositivo não é o VID/PID da L42 identificado. Teste cancelado para proteger os outros acessórios USB.");return;}
        byte[] bytes=command.getBytes(StandardCharsets.US_ASCII);
        if(manager.hasPermission(device)){send(device,bytes,language);return;}
        pendingDevice=device;pendingBytes=bytes;pendingLanguage=language;
        Intent i=new Intent(USB_ACTION).setPackage(getPackageName());
        PendingIntent pi=PendingIntent.getBroadcast(this,0,i,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));
        manager.requestPermission(device,pi);
        message("Aguardando autorização de acesso USB...");
    }
    private final BroadcastReceiver receiver=new BroadcastReceiver(){
        @Override public void onReceive(Context c,Intent i){
            if(!USB_ACTION.equals(i.getAction())||pendingDevice==null)return;
            UsbDevice d=pendingDevice;byte[] b=pendingBytes;String lang=pendingLanguage;
            pendingDevice=null;pendingBytes=null;pendingLanguage=null;
            if(i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED,false))send(d,b,lang);
            else message("Permissão USB negada.");
        }
    };
    private void send(UsbDevice device,byte[] bytes,String language){
        new Thread(()->{
            UsbInterface selected=null;UsbEndpoint endpoint=null;
            StringBuilder details=new StringBuilder();
            for(int ix=0;ix<device.getInterfaceCount();ix++){
                UsbInterface face=device.getInterface(ix);
                details.append("Interface ").append(ix).append(" classe ").append(face.getInterfaceClass()).append("; ");
                for(int j=0;j<face.getEndpointCount();j++){
                    UsbEndpoint ep=face.getEndpoint(j);
                    details.append("EP ").append(ep.getAddress()).append(" tipo ").append(ep.getType()).append(" direcao ").append(ep.getDirection()).append("; ");
                    if(ep.getType()==UsbConstants.USB_ENDPOINT_XFER_BULK && ep.getDirection()==UsbConstants.USB_DIR_OUT){
                        if(selected==null || (face.getInterfaceClass()==UsbConstants.USB_CLASS_PRINTER && selected.getInterfaceClass()!=UsbConstants.USB_CLASS_PRINTER)){
                            selected=face;endpoint=ep;
                        }
                    }
                }
            }
            if(selected==null||endpoint==null){message("Sem endpoint USB BULK OUT. "+details);return;}
            UsbDeviceConnection conn=manager.openDevice(device);
            if(conn==null){message("Falha ao abrir dispositivo. "+details);return;}
            try{
                if(!conn.claimInterface(selected,true))throw new Exception("Não foi possível ocupar interface USB.");
                int offset=0;
                while(offset<bytes.length){int n=Math.min(256,bytes.length-offset);int sent=conn.bulkTransfer(endpoint,bytes,offset,n,3500);if(sent<=0)throw new Exception("Transferência falhou no byte "+offset);offset+=sent;}
                message("Comando "+language+" aceito pela camada USB: "+offset+" bytes. Verifique se a impressora avançou papel. Interface "+selected.getId()+" endpoint "+endpoint.getAddress()+". "+details);
            }catch(Exception ex){message("ERRO "+language+": "+ex.getMessage()+". "+details);}
            finally{try{conn.releaseInterface(selected);}catch(Exception ignored){}conn.close();}
        },"wvs-usb-diag").start();
    }
    @Override protected void onDestroy(){try{unregisterReceiver(receiver);}catch(Exception ignored){}super.onDestroy();}
}