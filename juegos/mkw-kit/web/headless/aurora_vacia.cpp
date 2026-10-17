// GENERADO por herramientas/generar_aurora_vacia.py — no editar a mano.
// Funciones de aurora que el juego llama y que, sin pantalla (Node), no hacen nada.
// Las que deben responder algo con sentido están en aurora_manual.cpp.
#include <aurora/aurora.h>
#include <aurora/gfx.h>
#include <dolphin/gx/GXAurora.h>
#include <dolphin/gx/GXBump.h>
#include <dolphin/gx/GXCull.h>
#include <dolphin/gx/GXDispList.h>
#include <dolphin/gx/GXExtra.h>
#include <dolphin/gx/GXFrameBuffer.h>
#include <dolphin/gx/GXGeometry.h>
#include <dolphin/gx/GXGet.h>
#include <dolphin/gx/GXLighting.h>
#include <dolphin/gx/GXManage.h>
#include <dolphin/gx/GXPixel.h>
#include <dolphin/gx/GXTev.h>
#include <dolphin/gx/GXTexture.h>
#include <dolphin/gx/GXTransform.h>
#include <dolphin/gx/GXVert.h>
#include <dolphin/pad.h>
#include <dolphin/vi.h>

extern "C" void AuroraSetViewportPolicy(AuroraViewportPolicy policy) {}
extern "C" void GXApplyBPReg(u8 reg, u32 value) {}
extern "C" void GXBegin(GXPrimitive type, GXVtxFmt vtxfmt, u16 nverts) {}
extern "C" void GXCallDisplayList(const void* list, u32 nbytes) {}
extern "C" void GXClearBoundingBox(void) {}
extern "C" void GXClearVtxDesc(void) {}
extern "C" void GXColor3u8(u8 r, u8 g, u8 b) {}
extern "C" void GXColor4u8(u8 r, u8 g, u8 b, u8 a) {}
extern "C" void GXCopyDisp(void* dest, GXBool clear) {}
extern "C" void GXCopyTex(void* dest, GXBool clear) {}
extern "C" void GXDestroyCopyTex(void* dest) {}
extern "C" void GXDestroyTexObj(GXTexObj* obj) {}
extern "C" void GXDestroyTlutObj(GXTlutObj* obj) {}
extern "C" void GXDrawDone(void) {}
extern "C" void GXEnableTexOffsets(GXTexCoordID coord, GXBool line_enable, GXBool point_enable) {}
extern "C" extern void GXEnd(void) {}
extern "C" void GXFlush(void) {}
extern "C" void GXGetVtxDesc(GXAttr attr, GXAttrType* type) {}
extern "C" GXFifoObj* GXInit(void* base, u32 size) { return nullptr; }
extern "C" void GXInitLightAttn(GXLightObj* lt_obj, f32 a0, f32 a1, f32 a2, f32 k0, f32 k1, f32 k2) {}
extern "C" void GXInitLightColor(GXLightObj* lt_obj, GXColor color) {}
extern "C" void GXInitLightDir(GXLightObj* lt_obj, f32 nx, f32 ny, f32 nz) {}
extern "C" void GXInitLightPos(GXLightObj* lt_obj, f32 x, f32 y, f32 z) {}
extern "C" void GXInitTexObj(GXTexObj* obj, const void* data, u16 width, u16 height, GXTexFmt format, GXTexWrapMode wrapS, GXTexWrapMode wrapT, GXBool mipmap) {}
extern "C" void GXInitTexObjCI(GXTexObj* obj, const void* data, u16 width, u16 height, GXCITexFmt format, GXTexWrapMode wrapS, GXTexWrapMode wrapT, GXBool mipmap, u32 tlut) {}
extern "C" void GXInitTexObjData(GXTexObj* obj, const void* data) {}
extern "C" void GXInitTexObjLOD(GXTexObj* obj, GXTexFilter min_filt, GXTexFilter mag_filt, f32 min_lod, f32 max_lod, f32 lod_bias, GXBool bias_clamp, GXBool do_edge_lod, GXAnisotropy max_aniso) {}
extern "C" void GXInitTexObjTlut(GXTexObj* obj_, u32 tlut) {}
extern "C" void GXInitTexObjUserData(GXTexObj* obj, void* user_data) {}
extern "C" void GXInitTexObjWrapMode(GXTexObj* obj, GXTexWrapMode s, GXTexWrapMode t) {}
extern "C" void GXInitTlutObj(GXTlutObj* obj, const void* data, GXTlutFmt format, u16 entries) {}
extern "C" void GXInvalidateTexAll() {}
extern "C" void GXLoadLightObjImm(GXLightObj* lt_obj, GXLightID light) {}
extern "C" void GXLoadNrmMtxImm(const void* mtx, u32 id) {}
extern "C" void GXLoadPosMtxImm(const void* mtx, u32 id) {}
extern "C" void GXLoadTexMtxImm(const void* mtx, u32 id, GXTexMtxType type) {}
extern "C" void GXLoadTexObj(GXTexObj* obj, GXTexMapID id) {}
extern "C" void GXLoadTlut(const GXTlutObj* obj, u32 idx) {}
extern "C" void GXMatrixIndex1u8(GXAttr attr, u8 index) {}
extern "C" void GXNormal3f32(f32 x, f32 y, f32 z) {}
extern "C" void GXNormal3s16(s16 x, s16 y, s16 z) {}
extern "C" void GXNormal3s8(s8 x, s8 y, s8 z) {}
extern "C" void GXNormal3u16(u16 x, u16 y, u16 z) {}
extern "C" void GXNormal3u8(u8 x, u8 y, u8 z) {}
extern "C" void GXPixModeSync(void) {}
extern "C" void GXPosition2f32(f32 x, f32 y) {}
extern "C" void GXPosition2s16(s16 x, s16 y) {}
extern "C" void GXPosition2s8(s8 x, s8 y) {}
extern "C" void GXPosition2u16(u16 x, u16 y) {}
extern "C" void GXPosition2u8(u8 x, u8 y) {}
extern "C" void GXPosition3f32(f32 x, f32 y, f32 z) {}
extern "C" void GXPosition3s16(s16 x, s16 y, s16 z) {}
extern "C" void GXPosition3s8(s8 x, s8 y, s8 z) {}
extern "C" void GXPosition3u16(u16 x, u16 y, u16 z) {}
extern "C" void GXPosition3u8(u8 x, u8 y, u8 z) {}
extern "C" void GXSetAlphaCompare(GXCompare comp0, u8 ref0, GXAlphaOp op, GXCompare comp1, u8 ref1) {}
extern "C" void GXSetAlphaUpdate(GXBool update_enable) {}
extern "C" void GXSetArray(GXAttr attr, const void* data, u32 size, u8 stride, bool le) {}
extern "C" void GXSetBlendMode(GXBlendMode type, GXBlendFactor src_factor, GXBlendFactor dst_factor, GXLogicOp op) {}
extern "C" void GXSetChanAmbColor(GXChannelID chan, GXColor amb_color) {}
extern "C" void GXSetChanCtrl(GXChannelID chan, GXBool enable, GXColorSrc amb_src, GXColorSrc mat_src, u32 light_mask, GXDiffuseFn diff_fn, GXAttnFn attn_fn) {}
extern "C" void GXSetChanMatColor(GXChannelID chan, GXColor mat_color) {}
extern "C" void GXSetClipMode(GXClipMode mode) {}
extern "C" void GXSetCoPlanar(GXBool enable) {}
extern "C" void GXSetColorUpdate(GXBool update_enable) {}
extern "C" void GXSetCopyClamp(GXFBClamp clamp) {}
extern "C" void GXSetCopyFilter(GXBool aa, u8 sample_pattern[12][2], GXBool vf, u8 vfilter[7]) {}
extern "C" void GXSetCullMode(GXCullMode mode) {}
extern "C" void GXSetCurrentMtx(u32 id) {}
extern "C" void GXSetDispCopyDst(u16 wd, u16 ht) {}
extern "C" void GXSetDispCopyFrame2Field(u32 mode) {}
extern "C" void GXSetDispCopyGamma(GXGamma gamma) {}
extern "C" void GXSetDispCopySrc(u16 left, u16 top, u16 wd, u16 ht) {}
extern "C" void GXSetDither(GXBool dither) {}
extern "C" void GXSetDstAlpha(GXBool enable, u8 alpha) {}
extern "C" void GXSetFog(GXFogType type, f32 startz, f32 endz, f32 nearz, f32 farz, GXColor color) {}
extern "C" void GXSetIndTexCoordScale(GXIndTexStageID indStage, GXIndTexScale scaleS, GXIndTexScale scaleT) {}
extern "C" void GXSetIndTexMtx(GXIndTexMtxID mtx_sel, const void* offset, s8 scale_exp) {}
extern "C" void GXSetIndTexOrder(GXIndTexStageID ind_stage, GXTexCoordID tex_coord, GXTexMapID tex_map) {}
extern "C" void GXSetLineWidth(u8 width, GXTexOffset texOffsets) {}
extern "C" void GXSetNumChans(u8 nChans) {}
extern "C" void GXSetNumIndStages(u8 nIndStages) {}
extern "C" void GXSetNumTevStages(u8 nStages) {}
extern "C" void GXSetNumTexGens(u8 nTexGens) {}
extern "C" void GXSetPixelFmt(GXPixelFmt pix_fmt, GXZFmt16 z_fmt) {}
extern "C" void GXSetPointSize(u8 pointSize, GXTexOffset texOffsets) {}
extern "C" void GXSetProjection(const void* mtx, GXProjectionType type) {}
extern "C" void GXSetScissor(u32 left, u32 top, u32 wd, u32 ht) {}
extern "C" void GXSetScissorBoxOffset(s32 x_off, s32 y_off) {}
extern "C" void GXSetSourceVtxDesc(GXAttr attr, GXAttrType type) {}
extern "C" void GXSetTevAlphaIn(GXTevStageID stage, GXTevAlphaArg a, GXTevAlphaArg b, GXTevAlphaArg c, GXTevAlphaArg d) {}
extern "C" void GXSetTevAlphaOp(GXTevStageID stage, GXTevOp op, GXTevBias bias, GXTevScale scale, GXBool clamp, GXTevRegID out_reg) {}
extern "C" void GXSetTevColor(GXTevRegID id, GXColor color) {}
extern "C" void GXSetTevColorIn(GXTevStageID stage, GXTevColorArg a, GXTevColorArg b, GXTevColorArg c, GXTevColorArg d) {}
extern "C" void GXSetTevColorOp(GXTevStageID stage, GXTevOp op, GXTevBias bias, GXTevScale scale, GXBool clamp, GXTevRegID out_reg) {}
extern "C" void GXSetTevColorS10(GXTevRegID id, GXColorS10 color) {}
extern "C" void GXSetTevDirect(GXTevStageID tev_stage) {}
extern "C" void GXSetTevIndWarp(GXTevStageID tev_stage, GXIndTexStageID ind_stage, GXBool signed_offsets, GXBool replace_mode, GXIndTexMtxID matrix_sel) {}
extern "C" void GXSetTevIndirect(GXTevStageID tev_stage, GXIndTexStageID ind_stage, GXIndTexFormat format, GXIndTexBiasSel bias_sel, GXIndTexMtxID matrix_sel, GXIndTexWrap wrap_s, GXIndTexWrap wrap_t, GXBool add_prev, GXBool ind_lod, GXIndTexAlphaSel alpha_sel) {}
extern "C" void GXSetTevKAlphaSel(GXTevStageID stage, GXTevKAlphaSel sel) {}
extern "C" void GXSetTevKColor(GXTevKColorID id, GXColor color) {}
extern "C" void GXSetTevKColorSel(GXTevStageID stage, GXTevKColorSel sel) {}
extern "C" void GXSetTevOp(GXTevStageID id, GXTevMode mode) {}
extern "C" void GXSetTevOrder(GXTevStageID stage, GXTexCoordID coord, GXTexMapID map, GXChannelID color) {}
extern "C" void GXSetTevSwapMode(GXTevStageID stage, GXTevSwapSel ras_sel, GXTevSwapSel tex_sel) {}
extern "C" void GXSetTevSwapModeTable(GXTevSwapSel table, GXTevColorChan red, GXTevColorChan green, GXTevColorChan blue, GXTevColorChan alpha) {}
extern "C" void GXSetTexCoordBias(GXTexCoordID coord, GXBool s_enable, GXBool t_enable) {}
extern "C" void GXSetTexCoordGen2(GXTexCoordID dst_coord, GXTexGenType func, GXTexGenSrc src_param, u32 mtx, GXBool normalize, u32 postmtx) {}
extern "C" void GXSetTexCoordScaleManually(GXTexCoordID coord, GXBool enable, u16 ss, u16 ts) {}
extern "C" void GXSetTexCopyDst(u16 wd, u16 ht, GXTexFmt fmt, GXBool mipmap) {}
extern "C" void GXSetTexCopySrc(u16 left, u16 top, u16 wd, u16 ht) {}
extern "C" void GXSetViewport(f32 left, f32 top, f32 wd, f32 ht, f32 nearz, f32 farz) {}
extern "C" void GXSetViewportJitter(f32 left, f32 top, f32 wd, f32 ht, f32 nearz, f32 farz, u32 field) {}
extern "C" void GXSetVtxAttrFmt(GXVtxFmt vtxfmt, GXAttr attr, GXCompCnt cnt, GXCompType type, u8 frac) {}
extern "C" void GXSetVtxDesc(GXAttr attr, GXAttrType type) {}
extern "C" void GXSetZCompLoc(GXBool before_tex) {}
extern "C" void GXSetZMode(GXBool compare_enable, GXCompare func, GXBool update_enable) {}
extern "C" void GXSetZScaleOffset(f32 scale, f32 offset) {}
extern "C" void GXSetZTexture(GXZTexOp op, GXTexFmt fmt, u32 bias) {}
extern "C" void GXTexCoord1f32(f32 s) {}
extern "C" void GXTexCoord1s16(s16 s) {}
extern "C" void GXTexCoord1s8(s8 s) {}
extern "C" void GXTexCoord1u16(u16 s) {}
extern "C" void GXTexCoord1u8(u8 s) {}
extern "C" void GXTexCoord2f32(f32 s, f32 t) {}
extern "C" void GXTexCoord2s16(s16 s, s16 t) {}
extern "C" void GXTexCoord2s8(s8 s, s8 t) {}
extern "C" void GXTexCoord2u16(u16 s, u16 t) {}
extern "C" void GXTexCoord2u8(u8 s, u8 t) {}
extern "C" void PADControlMotor(u32 chan, u32 cmd) {}
extern "C" PADButtonMapping* PADGetAltButtonMappings(u32 port, u32* buttonCount) { return nullptr; }
extern "C" PADButtonMapping* PADGetButtonMappings(u32 port, u32* buttonCount) { return nullptr; }
extern "C" struct SDL_Gamepad* PADGetSDLGamepadForIndex(u32 index) { return nullptr; }
extern "C" BOOL PADRecalibrate(u32 mask) { return false; }
extern "C" BOOL PADReset(u32 mask) { return false; }
extern "C" void VIConfigure(const GXRenderModeObj *rm) {}
extern "C" void VILockAspectRatio(int width, int height) {}
extern "C" void VISetFrameBufferScale(float scale) {}
extern "C" void VIUnlockAspectRatio() {}
extern "C" AuroraDisplayMode aurora_get_display_mode() { return {}; }
extern "C" void aurora_report_producer_paced(bool paced) {}
extern "C" void aurora_set_frame_worker_wait_callback(AuroraFrameWorkerWaitCallback callback) {}
extern "C" void aurora_set_guest_write_hooks(AuroraGuestWriteGenerationCallback generation, AuroraGuestWriteNotifyCallback notify) {}
extern "C" void aurora_set_present_schedule(uint64_t baseNanos, uint64_t intervalNanos) {}
extern "C" void aurora_shutdown() {}
extern "C" void aurora_wait_for_frame_worker() {}
