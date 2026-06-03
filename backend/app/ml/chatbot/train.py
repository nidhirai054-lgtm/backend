"""
Train the LSTM intent classifier.
Run: python -m app.ml.chatbot.train
"""

import json
import os
import pickle
import numpy as np
import random

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Embedding, LSTM, Dropout, Dense
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.optimizers import Adam

BASE_DIR  = os.path.dirname(__file__)
INTENTS_PATH = os.path.join(BASE_DIR, "intents.json")
MODEL_DIR = os.path.join(BASE_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

MAX_WORDS   = 2000
MAX_SEQ_LEN = 20
EPOCHS      = 300
BATCH_SIZE  = 8


def train():
    with open(INTENTS_PATH, "r") as f:
        data = json.load(f)

    sentences, labels, classes = [], [], []
    for intent in data["intents"]:
        for pattern in intent["patterns"]:
            sentences.append(pattern.lower())
            labels.append(intent["tag"])
        if intent["tag"] not in classes:
            classes.append(intent["tag"])

    classes.sort()
    label_map = {c: i for i, c in enumerate(classes)}

    # Tokenize
    tokenizer = Tokenizer(num_words=MAX_WORDS, oov_token="<OOV>")
    tokenizer.fit_on_texts(sentences)
    sequences = tokenizer.texts_to_sequences(sentences)
    X = pad_sequences(sequences, maxlen=MAX_SEQ_LEN, padding="post")
    y = np.array([label_map[l] for l in labels])

    # One-hot encode
    Y = np.zeros((len(y), len(classes)))
    for i, c in enumerate(y):
        Y[i][c] = 1

    # Shuffle
    idx = list(range(len(X)))
    random.shuffle(idx)
    X, Y = X[idx], Y[idx]

    # Model
    model = Sequential([
        Embedding(MAX_WORDS, 64, input_length=MAX_SEQ_LEN),
        LSTM(128, return_sequences=False),
        Dropout(0.5),
        Dense(64, activation="relu"),
        Dense(len(classes), activation="softmax"),
    ])
    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )

    early_stop = EarlyStopping(monitor="val_accuracy", patience=30, restore_best_weights=True)

    model.fit(
        X, Y,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_split=0.2,
        callbacks=[early_stop],
        verbose=1,
    )

    # Save
    model.save(os.path.join(MODEL_DIR, "chatbot_model.h5"))
    with open(os.path.join(MODEL_DIR, "tokenizer.pkl"), "wb") as f:
        pickle.dump(tokenizer, f)
    with open(os.path.join(MODEL_DIR, "classes.pkl"), "wb") as f:
        pickle.dump(classes, f)

    print(f"\n✅ Model saved to {MODEL_DIR}")
    print(f"   Intents: {classes}")


if __name__ == "__main__":
    train()
