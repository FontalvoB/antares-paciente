package com.coppadresd.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

@CapacitorPlugin(name = "MedicationLabel")
public class MedicationLabelPlugin extends Plugin {
    @PluginMethod
    public void read(PluginCall call) {
        String encoded = call.getString("image");
        if (encoded == null || encoded.length() > 8_000_000) {
            call.reject("Invalid label image");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(encoded, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid label image");
            return;
        }
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bitmap == null) {
            call.reject("Invalid label image");
            return;
        }

        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener(result -> {
                JSObject response = new JSObject();
                response.put("text", result.getText());
                call.resolve(response);
            })
            .addOnFailureListener(error -> call.reject("Could not read label"))
            .addOnCompleteListener(task -> recognizer.close());
    }
}
