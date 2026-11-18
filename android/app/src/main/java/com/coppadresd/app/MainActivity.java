package com.coppadresd.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MedicationLabelPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
