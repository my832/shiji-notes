package com.shiji.notes;
import android.graphics.*;
import android.graphics.drawable.Drawable;

/** Paints behind transparent system bars while content keeps its safe insets. */
public final class SystemBarsBackground extends Drawable {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private int topInset,bottomInset;
    private int topLeft,topRight,base,bottom;
    private boolean initialized,appearanceDark;
    private int appearanceMode;
    private LinearGradient topGradient;
    public SystemBarsBackground(){setAppearance(false,0);}
    public void setInsets(int top,int bottom){int nextTop=Math.max(0,top),nextBottom=Math.max(0,bottom);if(topInset==nextTop&&bottomInset==nextBottom)return;topInset=nextTop;bottomInset=nextBottom;invalidateSelf();}
    private static int tint(int color){int overlay=Color.rgb(17,35,29);float a=71f/255f;return Color.rgb(Math.round(Color.red(color)*(1-a)+Color.red(overlay)*a),Math.round(Color.green(color)*(1-a)+Color.green(overlay)*a),Math.round(Color.blue(color)*(1-a)+Color.blue(overlay)*a));}
    public void setAppearance(boolean dark,int mode){
        if(initialized&&appearanceDark==dark&&appearanceMode==mode)return;
        initialized=true;appearanceDark=dark;appearanceMode=mode;topGradient=null;
        base=dark?Color.rgb(23,33,30):Color.rgb(245,246,242);
        topLeft=dark?Color.rgb(28,52,43):Color.rgb(222,238,229);topRight=base;bottom=base;
        if(mode==1){topLeft=tint(topLeft);topRight=tint(topRight);base=tint(base);bottom=dark?Color.rgb(32,48,40):Color.rgb(247,250,244);}
        else if(mode==2){topLeft=topRight=base=bottom=Color.rgb(12,21,24);}
        invalidateSelf();
    }
    @Override public void draw(Canvas canvas){
        Rect b=getBounds();paint.setShader(null);paint.setColor(base);canvas.drawRect(b,paint);
        if(topInset>0){if(topGradient==null)topGradient=new LinearGradient(b.left,b.top,b.right,b.top,topLeft,topRight,Shader.TileMode.CLAMP);paint.setShader(topGradient);canvas.drawRect(b.left,b.top,b.right,Math.min(b.bottom,b.top+topInset),paint);paint.setShader(null);}
        if(bottomInset>0){paint.setColor(bottom);canvas.drawRect(b.left,Math.max(b.top,b.bottom-bottomInset),b.right,b.bottom,paint);}
    }
    @Override public void setAlpha(int alpha){}
    @Override protected void onBoundsChange(Rect bounds){topGradient=null;}
    @Override public void setColorFilter(ColorFilter filter){}
    @Override public int getOpacity(){return PixelFormat.OPAQUE;}
}
