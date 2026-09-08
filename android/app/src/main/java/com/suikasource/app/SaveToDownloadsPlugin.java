package com.suikasource.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Menyimpan file langsung ke folder publik Download/<subFolder>/<fileName>.
 *
 * Android 10+ (API 29+) memakai MediaStore Downloads collection, tidak butuh
 * permission apapun. Android 9 ke bawah memakai File API biasa ke
 * getExternalStoragePublicDirectory(DIRECTORY_DOWNLOADS), butuh runtime
 * permission WRITE_EXTERNAL_STORAGE.
 */
@CapacitorPlugin(
    name = "SaveToDownloads",
    permissions = {
        @Permission(strings = { android.Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class SaveToDownloadsPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String subFolder = call.getString("subFolder", "BikinFoldernew SuikaSource");

        if (fileName == null || base64Data == null) {
            call.reject("fileName dan data wajib diisi");
            return;
        }

        byte[] bytes;
        try {
            bytes = decodeBase64(base64Data);
        } catch (Exception e) {
            call.reject("Data base64 tidak valid: " + e.getMessage());
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveViaMediaStore(call, fileName, bytes, mimeType, subFolder);
        } else {
            if (getPermissionState("storage") != PermissionState.GRANTED) {
                bridge.saveCall(call);
                requestPermissionForAlias("storage", call, "permissionCallback");
                return;
            }
            saveLegacy(call, fileName, bytes, subFolder);
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (call == null) {
            return;
        }
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            String fileName = call.getString("fileName");
            String subFolder = call.getString("subFolder", "BikinFoldernew SuikaSource");
            String base64Data = call.getString("data");
            try {
                byte[] bytes = decodeBase64(base64Data);
                saveLegacy(call, fileName, bytes, subFolder);
            } catch (Exception e) {
                call.reject("Data base64 tidak valid: " + e.getMessage());
            }
        } else {
            call.reject("Izin akses penyimpanan ditolak");
        }
    }

    private byte[] decodeBase64(String base64Data) {
        String cleanBase64 = base64Data;
        int commaIdx = cleanBase64.indexOf(',');
        if (cleanBase64.startsWith("data:") && commaIdx != -1) {
            cleanBase64 = cleanBase64.substring(commaIdx + 1);
        }
        return Base64.decode(cleanBase64, Base64.DEFAULT);
    }

    private void saveViaMediaStore(PluginCall call, String fileName, byte[] bytes, String mimeType, String subFolder) {
        try {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + subFolder);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            Uri itemUri = resolver.insert(collection, values);

            if (itemUri == null) {
                call.reject("Gagal membuat entri file di MediaStore");
                return;
            }

            try (OutputStream out = resolver.openOutputStream(itemUri)) {
                if (out == null) {
                    call.reject("Gagal membuka output stream");
                    return;
                }
                out.write(bytes);
                out.flush();
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(itemUri, values, null, null);

            JSObject result = new JSObject();
            result.put("path", Environment.DIRECTORY_DOWNLOADS + "/" + subFolder + "/" + fileName);
            result.put("uri", itemUri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Gagal menyimpan file: " + e.getMessage(), e);
        }
    }

    private void saveLegacy(PluginCall call, String fileName, byte[] bytes, String subFolder) {
        try {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File targetDir = new File(downloadsDir, subFolder);
            if (!targetDir.exists() && !targetDir.mkdirs()) {
                call.reject("Gagal membuat folder tujuan");
                return;
            }
            File targetFile = new File(targetDir, fileName);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(bytes);
                fos.flush();
            }

            JSObject result = new JSObject();
            result.put("path", targetFile.getAbsolutePath());
            result.put("uri", Uri.fromFile(targetFile).toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Gagal menyimpan file: " + e.getMessage(), e);
        }
    }
}
