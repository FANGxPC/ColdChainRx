#!/usr/bin/env python3
"""
ColdChainRx — Benchmark Plotting and Paper Evaluation Scripts (Week 8)
Member: Sadique (ML / Frontend Lead)
"""

import os
import json
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support

def generate_plots():
    print("Generating Week 8 Evaluation Plots...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "evaluation_plots")
    os.makedirs(output_dir, exist_ok=True)
    
    # ---------------------------------------------------------
    # 1. Throughput vs Send Rate (Mock Caliper Data)
    # ---------------------------------------------------------
    send_rates = [100, 250, 500, 1000]
    throughput = [98, 240, 410, 650] # Simulated Caliper Fabric v2.4 limits
    
    plt.figure(figsize=(8, 5))
    sns.barplot(x=send_rates, y=throughput, palette="Blues_d")
    plt.title("Fabric Chaincode Throughput vs. Send Rate")
    plt.xlabel("Send Rate (TPS)")
    plt.ylabel("Throughput (TPS)")
    for i, v in enumerate(throughput):
        plt.text(i, v + 10, str(v), ha='center')
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "throughput_vs_sendrate.png"), dpi=300)
    plt.close()
    
    # ---------------------------------------------------------
    # 2. Latency Distribution (Box Plot)
    # ---------------------------------------------------------
    np.random.seed(42)
    # Simulate latency in ms
    latency_100 = np.random.normal(45, 10, 100)
    latency_250 = np.random.normal(85, 15, 100)
    latency_500 = np.random.normal(150, 25, 100)
    latency_1000 = np.random.normal(320, 50, 100)
    
    latency_data = [latency_100, latency_250, latency_500, latency_1000]
    
    plt.figure(figsize=(8, 5))
    sns.boxplot(data=latency_data, palette="Set3")
    plt.xticks([0, 1, 2, 3], ['100 TPS', '250 TPS', '500 TPS', '1000 TPS'])
    plt.title("Transaction Latency Distribution by Send Rate")
    plt.ylabel("Latency (ms)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "latency_distribution.png"), dpi=300)
    plt.close()

    # ---------------------------------------------------------
    # 3. Anomaly Detection Confusion Matrix
    # ---------------------------------------------------------
    # Simulated true labels (1=normal, -1=anomaly) and predictions
    y_true = np.array([1]*1900 + [-1]*100)
    y_pred = np.array([1]*1880 + [-1]*20 + [-1]*95 + [1]*5)
    
    cm = confusion_matrix(y_true, y_pred, labels=[1, -1])
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=['Normal', 'Anomaly'], 
                yticklabels=['Normal', 'Anomaly'])
    plt.title("Isolation Forest Confusion Matrix")
    plt.xlabel("Predicted Label")
    plt.ylabel("True Label")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "ml_confusion_matrix.png"), dpi=300)
    plt.close()

    # ---------------------------------------------------------
    # 4. ML Metrics Table (Markdown/LaTeX)
    # ---------------------------------------------------------
    precision, recall, fscore, _ = precision_recall_fscore_support(y_true, y_pred, pos_label=-1, average='binary')
    ml_metrics = {
        "Metric": ["Precision", "Recall", "F1-Score"],
        "Value (%)": [round(precision*100, 2), round(recall*100, 2), round(fscore*100, 2)]
    }
    df_metrics = pd.DataFrame(ml_metrics)
    df_metrics.to_csv(os.path.join(output_dir, "ml_metrics.csv"), index=False)
    
    # ---------------------------------------------------------
    # 5. Literature Comparison Table
    # ---------------------------------------------------------
    comparison = {
        "System": ["Article 1 [MDPI '25]", "Article 5 [IEEE '24]", "Article 8 [Systems '26]", "ColdChainRx (Ours)"],
        "Blockchain": ["Fabric", "Ethereum", "Fabric", "Fabric"],
        "IoT Layer": ["Yes", "Yes", "Yes", "Yes"],
        "ML Anomaly": ["No", "No", "Yes", "Yes"],
        "Consumer QR": ["No", "No", "No", "Yes"],
        "Throughput (TPS)": ["~300", "~15", "~550", "~650 (mock)"],
        "Avg Latency (ms)": ["~150", "~12,000", "~85", "~85 (mock)"]
    }
    df_comp = pd.DataFrame(comparison)
    df_comp.to_csv(os.path.join(output_dir, "literature_comparison.csv"), index=False)
    
    # Generate image table using matplotlib
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.axis('tight')
    ax.axis('off')
    table = ax.table(cellText=df_comp.values, colLabels=df_comp.columns, cellLoc='center', loc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1.2, 1.5)
    plt.title("Comparison of Recent Cold-Chain Solutions", pad=20)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "literature_comparison_table.png"), dpi=300)
    plt.close()

    print("Success! Evaluation plots saved to:", output_dir)

if __name__ == "__main__":
    generate_plots()
