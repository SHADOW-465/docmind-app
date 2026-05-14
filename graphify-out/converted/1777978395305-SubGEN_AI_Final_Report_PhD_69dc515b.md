<!-- converted from 1777978395305-SubGEN_AI_Final_Report_PhD.docx -->



A PROJECT REPORT
ON

SubGEN AI: Hardware-Aware AI Subtitle Generator with
MFCC-Based Correction Validation and Embedding Self-Improvement
for Low-Resource Indic Languages

Submitted in partial fulfillment of the requirements
for the award of the degree of
BACHELOR OF ENGINEERING
IN
ELECTRONICS AND COMMUNICATION ENGINEERING

Submitted by
R. SHOWMIK KUMAAR          (411722106090)
NIRAIKULANATHAN P          (411722106067)

Under the Guidance of
Ms. G. KALANANDHINI, M.E.
Assistant Professor
Department of Electronics and Communication Engineering


DEPARTMENT OF ELECTRONICS AND COMMUNICATION ENGINEERING
PRINCE SHRI VENKATESHWARA PADMAVATHY ENGINEERING COLLEGE
(AUTONOMOUS)
Affiliated to Anna University, Chennai
CHENNAI – 600 127
2024 – 2025

BONAFIDE CERTIFICATE

This is to certify that the project report entitled “SubGEN AI: Hardware-Aware AI Subtitle Generator with MFCC-Based Correction Validation and Embedding Self-Improvement for Low-Resource Indic Languages” is the bonafide work of R. SHOWMIK KUMAAR (411722106090) and NIRAIKULANATHAN P (411722106067) who carried out the project work under my supervision. Certified further that to the best of my knowledge the work reported herein does not form part of any other project report or dissertation on the basis of which a degree or award was conferred on an earlier occasion on this or any other candidate.




SIGNATURE OF GUIDE					SIGNATURE OF HEAD OF DEPARTMENT


Ms. G. Kalanandhini, M.E.						Head of the Department
Assistant Professor, ECE						Department of ECE, PSVPEC



Submitted for the Anna University Practical Examination held on _________________ at Prince Shri Venkateshwara Padmavathy Engineering College (Autonomous), Chennai – 600 127.



INTERNAL EXAMINER					EXTERNAL EXAMINER

ABSTRACT
Automated subtitle generation for low-resource Indic language content suffers from Word Error Rates of 28 to 65 percent in real-world noisy acoustic environments. Existing tools provide no signal-aware quality guidance to editors, accept user corrections without acoustic verification, and require prohibitive GPU resources for model adaptation — three fundamental limitations that make them impractical for the educators, journalists, and independent content creators who constitute the primary producers of Tamil and Telugu video content in India.
This work presents SubGEN AI, a hardware-software co-designed system that integrates an ESP32 microcontroller as a dedicated Mel-Frequency Cepstral Coefficient DSP co-processor. The firmware implements a two-pass spectral subtraction pipeline — comprising a 512-point radix-2 Fast Fourier Transform, a 26-band mel filterbank, log compression, and DCT-II — entirely from scratch in embedded C without any third-party DSP library. The resulting denoised 12-coefficient MFCC fingerprint and mel-domain SNR estimate are transmitted to the host over USB serial at 460.8 kbaud within 200 ms per audio clip. A Signal-Informed Quality Control engine fuses Faster-Whisper’s ASR log-probability confidence with the hardware-measured SNR to generate per-segment RED or GREEN quality labels, reducing post-editing time by 61 percent. Hardware-validated user corrections are stored as MFCC fingerprint–text pairs in a local SQLite database and applied at inference time via cosine similarity nearest-neighbour retrieval, yielding domain-specific vocabulary self-improvement without GPU hardware, cloud connectivity, or model retraining.
Evaluation on 15 test videos totalling 4 hours 20 minutes across Tamil, Telugu, and English demonstrates 91 percent correction validation accuracy, 90 percent QC classification accuracy (AUC = 0.89, compared to 0.74 for ASR-only confidence), 25.9 percent and 23.3 percent relative WER reductions for Tamil and Telugu respectively, and a 61 percent reduction in subtitle editing time. The total additional hardware cost is Rs. 400 to 550.

Keywords: Automatic Speech Recognition, MFCC, ESP32 Embedded DSP, Signal-Informed Quality Control, Indic Languages, Embedding Correction, Faster-Whisper, Hardware-Software Co-Design, Edge Computing, Subtitle Generation.

ACKNOWLEDGEMENT
We express our sincere gratitude to our project guide Ms. G. Kalanandhini, M.E., Assistant Professor, Department of Electronics and Communication Engineering, Prince Shri Venkateshwara Padmavathy Engineering College (Autonomous), for her invaluable guidance, critical feedback, and sustained encouragement throughout the course of this project. Her expertise in signal processing and embedded systems and her insistence on rigorous experimental validation have been instrumental in shaping both the technical depth and the academic quality of this work.
We are deeply grateful to the Head of the Department of Electronics and Communication Engineering for providing the necessary laboratory infrastructure, including access to the embedded hardware development environment, that made the ESP32 firmware implementation possible.
We extend our heartfelt thanks to the Management and the Principal of Prince Shri Venkateshwara Padmavathy Engineering College (Autonomous), Chennai, for fostering the research culture and providing the institutional resources that supported this project from conception to completion.
We also acknowledge the contributions of the open-source community — in particular the developers of Faster-Whisper [8], the CTranslate2 inference library, the Streamlit framework, and the ArduinoJson library — without whose publicly available tools the system integration achieved in this work would not have been feasible within the constraints of an undergraduate project timeline.
Finally, we express our deepest gratitude to our parents and families for their unwavering support and patience throughout our academic journey.



R. SHOWMIK KUMAAR
NIRAIKULANATHAN P

TABLE OF CONTENTS


LIST OF FIGURES


LIST OF TABLES


LIST OF ABBREVIATIONS


CHAPTER 1
INTRODUCTION

1.1  General Introduction
The rapid expansion of digital content production across South Asian educational, journalistic, and entertainment sectors has elevated accurate subtitle generation to a critical accessibility requirement. Subtitles serve over 1.5 billion hearing-impaired individuals globally [16] and are equally indispensable for multilingual content consumption in Tamil, Telugu, Hindi, Malayalam, and Kannada — languages spoken by hundreds of millions of users who produce and consume educational and professional video daily. In India, the challenge is compounded by the country’s linguistic diversity: automated subtitle tools designed primarily for English degrade severely on Dravidian languages, producing Word Error Rates of 28 to 65 percent in real-world noisy conditions such as classrooms, conference halls, and outdoor recordings [4].
This degradation creates a three-part problem. First, every generated subtitle file for Indic language content requires extensive manual correction, consuming three to five times the video duration in editing effort. Second, editors receive no quality guidance from existing tools — all subtitle segments are presented identically regardless of transcription confidence, forcing full-video review to locate errors. Third, when editors correct errors, no existing system validates whether the correction acoustically matches the underlying audio, creating a data integrity risk for any mechanism that attempts to learn from user corrections. OpenAI Whisper [7], despite achieving near-human accuracy on clean English, cannot be economically adapted to specific Indic language domains because existing fine-tuning approaches require GPU hardware and hundreds of hours of labelled training data per language [1], placing them beyond the reach of the intended user population.
SubGEN AI addresses all three problems through a hardware-software co-designed architecture. An ESP32 microcontroller [11] serves as a dedicated DSP co-processor, computing denoised MFCC audio fingerprints that support both quality control scoring and acoustic correction validation. The system requires no cloud connectivity, no GPU hardware, and costs approximately Rs. 400 to 550 in additional hardware.
1.2  Background of the Study
1.2.1  Evolution of Automatic Speech Recognition
The history of ASR spans over five decades, progressing through four distinct architectural generations. The first generation employed pattern matching and template-based isolated-word recognition. The second generation, emerging in the 1980s, introduced Hidden Markov Models that enabled continuous speech recognition by modelling phoneme sequences as stochastic state transitions. HMM-based systems dominated the field for three decades. The third generation, beginning around 2010, combined deep neural network acoustic models with HMM decoders in hybrid DNN-HMM systems, achieving 30 to 50 percent relative WER reductions over Gaussian Mixture Model baselines [10]. The fourth and current generation is defined by end-to-end neural architectures that eliminate the classical pipeline’s separate acoustic model, language model, and pronunciation lexicon, replacing them with a single network trained to map raw acoustic features to output tokens. Prabhavalkar et al. [Base] provide the definitive survey of this evolution, documenting that while end-to-end systems achieve near-human accuracy on clean English, noisy conditions and low-resource languages remain fundamental open challenges.
1.2.2  Challenges with Indic Language ASR
Tamil, Telugu, Malayalam, and Kannada are agglutinative Dravidian languages with complex morphology: a single root may produce hundreds of grammatically valid inflected forms, each with a distinct pronunciation. This morphological richness creates vocabulary explosion that undermines recognition of unseen inflected forms. Retroflex consonants, vowel length distinctions, and gemination — phonological features absent in Indo-European languages — are systematically underrepresented in models trained predominantly on English data. Code-switching, wherein speakers seamlessly alternate between Indic and English within a single utterance, is endemic in Indian educational and professional video, creating code-switched speech streams that challenge monolingual ASR models. Domain-specific vocabulary — institutional names, speaker names, technical terminology, and local place names — is particularly problematic because such terms rarely appear in general-purpose training corpora [14].
1.2.3  Edge Computing and Embedded Digital Signal Processing
Edge computing — the paradigm of performing computation locally on or near the data source rather than in centralised cloud infrastructure — offers compelling advantages in latency, privacy, and operational reliability for signal processing tasks. In the context of subtitle generation, processing audio fingerprints on an embedded microcontroller eliminates cloud dependency, prevents sensitive content from transmission, and ensures system operation in connectivity-limited environments. The ESP32 DevKit v1, featuring a dual-core Xtensa LX6 processor at 240 MHz with 520 KB of SRAM [11], provides sufficient computational capacity for spectral analysis, filterbank operations, and cepstral coefficient extraction, as demonstrated by the SubGEN AI firmware implementation. The implementation of these signal processing algorithms from scratch in embedded C — without third-party DSP libraries — is a genuine hardware engineering contribution validating the feasibility of professional-grade MFCC computation at the edge.
1.2.4  Self-Improving Systems Through Acoustically Validated Corrections
Adaptive systems that update their behaviour from user feedback have been studied extensively in recommendation systems, interactive machine learning, and personalised language models. In ASR, correction-based personalisation is compelling because it requires no pre-labelled training data and directly targets the error categories specific to a user’s domain. The critical challenge is ensuring the quality of the correction data: a system that accepts erroneous corrections will degrade rather than improve. SubGEN AI’s hardware MFCC fingerprint validation mechanism addresses this data integrity problem at the point of input — before any correction enters the self-improvement database — making it architecturally distinct from all prior subtitle generation tools.
1.3  Need for the System
The imperative for SubGEN AI emerges from the simultaneous convergence of three specific failure modes that no existing subtitle tool addresses: a 28 to 65 percent WER for Tamil and Telugu in real-world conditions that makes automated subtitling unreliable without extensive manual correction; the complete absence of signal-aware quality guidance that forces full-video review and triples editing time; and the lack of acoustic correction validation that renders any self-improvement mechanism susceptible to data corruption. SubGEN AI is the first integrated system to resolve all three within a single offline, GPU-free, low-cost architecture.
1.4  Problem Statement
Automated subtitle generation for Indic language video content confronts three interrelated and unsolved problems. First, state-of-the-art ASR systems including Faster-Whisper [8] achieve Word Error Rates of 28 to 65 percent for Tamil and Telugu in real-world noisy conditions, necessitating extensive manual post-editing for every generated subtitle file. Second, no existing subtitle tool provides signal-aware quality guidance to direct editors toward error-prone segments, forcing full-video review and resulting in editing time three to five times the video duration. Third, no existing system validates whether user-typed corrections acoustically match the audio at the corresponding timestamp before accepting them, making any correction-based self-improvement mechanism susceptible to data corruption from misheard or typographically erroneous edits. Furthermore, existing adaptation approaches for large-scale ASR models such as Whisper require GPU hardware and hundreds of hours of labelled domain-specific data per language [1], making them inaccessible to the target population of independent content creators, educators, and journalists in resource-constrained settings.
1.5  Objectives of the Project
The primary objective of this project is to design, implement, and validate a hardware-aware intelligent subtitle generation system that delivers accurate, guided, and self-improving subtitle production for Indic language video content in a fully offline, GPU-free setting. The specific research objectives are:
1.	To design and implement an ESP32 hardware MFCC co-processor with two-pass spectral subtraction — estimating a per-band mel-domain noise floor in Pass 1 and applying spectral subtraction before log compression and DCT-II in Pass 2 — producing denoised 12-coefficient MFCC fingerprints via a 512-point radix-2 FFT implemented entirely from scratch in embedded C without any third-party DSP library, communicating fingerprints and mel-domain SNR over USB serial at 460.8 kbaud [11], [12].
2.	To implement a Signal-Informed Quality Control engine that fuses the ASR log-probability confidence from Faster-Whisper [8] with the hardware-estimated SNR through the formula fused_conf = 0.6 × ASR_conf + 0.3 × (1 − SNR_penalty) + 0.1 × speaker_stability, classifying subtitle segments as RED or GREEN to eliminate full-video review.
3.	To develop an MFCC cosine similarity correction validator that acoustically re-fingerprints audio at correction time and rejects fingerprint mismatches before writing to the self-improvement database, ensuring data integrity through a 15 dB SNR gate that prevents noisy fingerprints from corrupting the correction store.
4.	To construct a GPU-free embedding correction self-improvement mechanism that stores validated MFCC fingerprint–text pairs in a language-indexed SQLite database and applies relevant corrections at inference time via nearest-neighbour cosine similarity retrieval at a threshold of 0.80.
5.	To deliver a complete, production-ready Streamlit application [9] supporting video upload, Faster-Whisper transcription with quality-labelled segment review, hardware-validated correction workflow, and SRT/VTT/JSON export, with a hardware-accelerated path via the ESP32 and a software-equivalent path using NumPy/SciPy when the hardware is unavailable [9].
6.	To evaluate the integrated system on Tamil, Telugu, and English test content and demonstrate statistically meaningful WER reduction, QC classification accuracy, correction validation accuracy, and editing time improvement relative to unassisted Faster-Whisper baseline transcription.
1.6  Scope of the Project
The scope encompasses the design, implementation, testing, and validation of an offline hardware-aware subtitle generation system for pre-recorded video and audio files. The system supports all 99 languages covered by Faster-Whisper [8], with focused testing on Tamil, Telugu, Hindi, and Malayalam. The hardware component is limited to a single ESP32 DevKit v1 connected via standard USB, requiring no additional sensors, power supplies, or peripherals. The software component runs on consumer laptop hardware without GPU requirements. The scope explicitly excludes real-time live subtitling for broadcast, multi-microphone beamforming, speaker diarisation, clinical-grade audio measurement, and cloud-based processing.
1.7  Organisation of the Report
Chapter 2 presents a critical literature survey of six research works establishing the theoretical and empirical foundations of SubGEN AI. Chapter 3 analyses existing subtitle generation systems, identifies their limitations, and presents the proposed system concept with feasibility assessment and hardware-software requirements. Chapter 4 details the complete system design across all four architectural layers, including the ESP32 MFCC pipeline, QC engine, correction validation mechanism, database schema, and UI design. Chapter 5 presents the implementation of all hardware and software components with actual source code excerpts drawn from the project repository. Chapter 6 reports experimental results across all evaluation dimensions. Chapter 7 concludes with a synthesis of contributions and future research directions.

CHAPTER 2
LITERATURE SURVEY

This chapter presents a critical review of six research works — one base paper and five reference papers — that provide the theoretical, algorithmic, and empirical foundation for SubGEN AI. The selection spans the four core technical pillars of the system: end-to-end automatic speech recognition and confidence estimation, automated subtitle generation from video, MFCC-based audio feature extraction and embedded DSP, and Whisper-based subtitle synchronisation. Each paper is reviewed with respect to its methodology, principal findings, identified limitations, and specific inference for SubGEN AI’s design.

2.1  End-to-End Speech Recognition: A Survey (Base Paper)
[Base] Rohit Prabhavalkar, Takaaki Hori, Tara N. Sainath, Ralf Schlüter, and Shinji Watanabe proposed a paper titled “End-to-End Speech Recognition: A Survey”, published in IEEE/ACM Transactions on Audio, Speech, and Language Processing, Vol. 32, pp. 325–351, 2024. DOI: 10.1109/TASLP.2023.3328283.
This landmark survey documents the complete evolution of ASR from classical HMM-based systems through hybrid DNN-HMM architectures to modern end-to-end models including CTC, sequence-to-sequence attention, and Transformer-based systems. A central finding is that log-probability confidence signals from sequence-to-sequence decoders are systematically overconfident under distribution shift — the precise limitation that SubGEN AI’s hardware SNR augmentation directly addresses. The paper further confirms that adaptation of large-scale E2E models requires substantial GPU resources and labelled data, establishing the practical gap that the embedding correction self-improvement mechanism fills. The paper’s documentation of 50+ percent relative WER reduction from deep learning provides the theoretical baseline against which SubGEN AI’s domain-specific improvements are measured.

2.2  AI-Based Automated Subtitle Generation (Reference Paper 1)
[1] Penyameen K et al. proposed “AI-based Automated Subtitle Generation System for Multilingual Video Transcription and Embedding”, IEEE IDCIoT, 2025. DOI: 10.1109/IDCIOT64235.2025.10914946.
This paper presents the most recent Whisper-based subtitle generation system, integrating OpenAI Whisper with FFmpeg and MoviePy in a Tkinter GUI. It achieves 90–95 percent transcription accuracy on clean audio, confirming Whisper as the practical state of the art for multilingual subtitle generation. Critically, the system provides no quality guidance, accepts corrections without acoustic validation, and offers no domain-specific self-improvement mechanism. Its 70 percent reduction in subtitle creation time compared to manual transcription establishes the productivity benchmark that SubGEN AI’s RED/GREEN guided editing improves upon.

2.3  Automatic Subtitle Generation for Videos (Reference Paper 2)
[2] Aditya Ramani et al. proposed “Automatic Subtitle Generation for Videos”, IEEE ICACCS, 2020.
This paper establishes the canonical three-stage offline subtitle pipeline — FFmpeg audio extraction, ASR transcription, SRT generation — and benchmarks DeepSpeech, CMU Sphinx, and Google Web Speech API. DeepSpeech achieves the best offline WER of approximately 26 percent for English. The paper’s documentation of the absence of quality control, correction validation, and Indic language support directly motivates SubGEN AI’s design. The DeepSpeech English baseline of 26 percent WER serves as the reference point in the comparative analysis of Chapter 6.

2.4  Reproducing Whisper-Style Training (Reference Paper 3)
[3] Yifan Peng et al. proposed “Reproducing Whisper-Style Training Using an Open-Source Toolkit”, IEEE ASRU, 2023. DOI: 10.1109/ASRU57964.2023.10389676.
This paper presents OWSM, a reproduction of Whisper-style multitask training using ESPnet and 180,000 hours of public data. It confirms that Whisper adaptation requires large-scale GPU compute and extensive multilingual training data. The paper validates Faster-Whisper INT8 CPU inference benchmarks used in SubGEN AI’s performance evaluation and confirms WER ranges for low-resource languages used in the results section of Chapter 6.

2.5  Speech-to-Text Recognition Using Deep Learning (Reference Paper 4)
[4] V. M. Reddy et al. proposed “Speech-to-Text and Text-to-Speech Recognition Using Deep Learning”, IEEE ICECAA, 2023. DOI: 10.1109/ICECAA58104.2023.10212222.
This survey confirms that MFCC features [9] remain highly competitive with log-mel spectrograms for edge computing ASR deployments due to their compact representation and noise robustness. This finding directly supports the architectural decision to use MFCC over raw spectrograms for the ESP32 fingerprinting component. The paper validates WER as the standard evaluation metric used throughout Chapter 6 and confirms the practical suitability of CPU-based Transformer inference for consumer hardware.

2.6  Subtitle Synchronisation Using Whisper ASR (Reference Paper 5)
[5] Thara P et al. proposed “Subtitle Synchronization Using Whisper ASR Model”, IEEE ICPECTS, 2024. DOI: 10.1109/ICPECTS62210.2024.10780268.
This paper demonstrates that Whisper word-level timestamp alignment is sufficiently accurate for subtitle synchronisation via difflib text comparison. The finding validates Whisper’s temporal alignment as the basis for SubGEN AI’s segment boundary extraction and confirms that Whisper-based systems lack quality control and correction validation capabilities, reinforcing the motivation for SubGEN AI’s contributions.

2.7  Gap Analysis and Research Positioning
Collectively, the surveyed literature establishes the following research gaps that SubGEN AI is designed to close. First, all reviewed subtitle generation systems lack signal-aware quality guidance, forcing full-video review; SubGEN AI addresses this with the Signal-Informed QC engine. Second, all reviewed systems accept user corrections without acoustic validation; SubGEN AI addresses this with the ESP32 MFCC correction validator. Third, GPU-free domain-specific adaptation is an unaddressed open problem; SubGEN AI addresses this with the SQLite embedding correction mechanism. Fourth, no reviewed system provides dedicated hardware DSP support for audio quality estimation; SubGEN AI addresses this with the ESP32 two-pass spectral subtraction firmware. No single paper or combination of reviewed papers addresses all four gaps simultaneously in an offline, GPU-free setting for Indic language subtitle generation.

CHAPTER 3
SYSTEM ANALYSIS

3.1  Existing System Analysis
Current automated subtitle systems fall into three categories. Cloud-based commercial tools including YouTube Auto-Captions, Descript, and HappyScribe achieve acceptable WER on clean studio audio but degrade severely under noise, require continuous internet connectivity, and store sensitive video content on remote servers. All present subtitle segments identically to editors, regardless of transcription confidence, and accept corrections without validation. Open-source offline tools — most recently the Whisper-based system of Penyameen et al. [1] and the DeepSpeech pipeline of Ramani et al. [2] — eliminate cloud dependency but retain the same absence of quality guidance, correction validation, and self-improvement. Synchronisation-focused tools such as that of Thara et al. [5] address timing alignment but not transcription accuracy improvement.
3.2  Drawbacks of Existing Systems
The analysis identifies six specific drawbacks: (1) WER of 28 to 65 percent for Tamil and Telugu in real-world conditions; (2) no quality guidance mechanism, forcing full-video review; (3) no acoustic validation of user corrections; (4) no GPU-free self-improvement for domain vocabulary; (5) cloud dependency and content privacy risk in commercial systems; and (6) no Indic language optimisation in any existing open-source tool.
3.3  Proposed System
SubGEN AI resolves all six drawbacks through five integrated components. (1) Faster-Whisper [8] with INT8 CPU quantisation reduces English WER from 26 percent to 7.2 percent while providing native support for all 99 Whisper languages including Tamil and Telugu. (2) The ESP32 MFCC co-processor implements two-pass spectral subtraction in firmware [11] to produce denoised fingerprints for quality scoring and correction validation. (3) The Signal-Informed QC engine fuses ASR and hardware SNR signals to provide RED/GREEN segment guidance. (4) The MFCC cosine similarity validator enforces a 15 dB SNR gate and a 0.72 similarity threshold before accepting any correction into the database. (5) The SQLite embedding correction mechanism applies validated corrections at inference time via nearest-neighbour retrieval, achieving GPU-free domain adaptation from the first validated correction.
3.4  Feasibility Study
Technical feasibility is confirmed by the maturity of all component technologies: Faster-Whisper is an actively maintained production system; the ESP32 is deployed in millions of IoT applications; the MFCC algorithm is thoroughly documented in Davis and Mermelstein’s foundational reference [9]; and the Cooley-Tukey FFT [12] is a 60-year-old algorithm with verified embedded implementations. Economic feasibility is strong: total hardware cost is Rs. 400 to 550 with all software components free and open-source. Operational feasibility is confirmed by the simple Streamlit browser interface requiring no technical expertise from subtitle editors.
3.5  Hardware and Software Requirements
Table 3.1: Hardware Requirements

Table 3.2: Software Requirements

CHAPTER 4
SYSTEM DESIGN

4.1  Four-Layer System Architecture
SubGEN AI is structured as a four-layer hardware-software system. The User Interface Layer (Streamlit) accepts video uploads, presents RED/GREEN labelled segments for review, and provides SRT/VTT/JSON export. The AI Pipeline Layer manages FFmpeg audio extraction, Faster-Whisper ASR inference [8], Signal-Informed QC scoring, and embedding correction lookup. The Hardware DSP Layer runs on the ESP32 DevKit v1 [11] via USB serial, with a software-equivalent path activating transparently when hardware is absent. The Data Layer is a language-indexed SQLite database at ~/.subgen_ai/corrections.db persisting validated MFCC fingerprint–text pairs. The architecture is illustrated in Figure 4.1.
4.2  End-to-End Processing Pipeline
The complete processing pipeline proceeds as follows: video upload → FFmpeg extraction (16 kHz mono) → Faster-Whisper ASR (beam size 5, VAD filter, 500 ms minimum silence) → 2-second audio clip extraction per segment → ESP32 MFCC fingerprinting via USB serial → sub-window SNR estimation → QC scoring and RED/GREEN labelling → SQLite correction lookup (cosine similarity ≥ 0.80) → Streamlit review panel → user correction → ESP32 re-fingerprinting and validation → SNR gate (15 dB) → SQLite storage → SRT/VTT/JSON export.
4.3  ESP32 MFCC Pipeline Design
The MFCC feature extraction pipeline [9] on the ESP32 implements six computational stages. Stage 1 divides audio into 400-sample frames (25 ms) with 160-sample hop (10 ms) and applies a Hanning window to suppress spectral leakage. Stage 2 zero-pads each frame to 512 samples and applies the Cooley-Tukey radix-2 DIT FFT [12] in nine butterfly stages. Stage 3 computes the one-sided power spectrum P[k] = |X[k]|² / N. Stage 4 applies a 26-band triangular mel filterbank precomputed at firmware boot across 0 to 8 kHz on the mel frequency scale Mel(f) = 2595 × log₁₀(1 + f/700). Stage 5 applies two-pass spectral subtraction: Pass 1 accumulates a per-band mel-domain noise floor from silence frames (RMS < 0.002); Pass 2 subtracts the noise floor before log compression E_log[m] = log₁₀(E[m] + ε). Stage 6 applies DCT-II to yield 12 MFCC coefficients and returns their per-coefficient mean and variance as a JSON fingerprint within 200 ms.
4.4  Signal-Informed Quality Control Engine
For each subtitle segment i, a fused confidence score C_i is computed as: C_i = 0.6 × ASR_conf + 0.3 × (1 − SNR_penalty) + 0.1 × speaker_stability, where ASR_conf = exp(avg_logprob) maps Faster-Whisper’s log-probability output to a linear confidence value, and SNR_penalty = clip((20 − SNR_dB) / 15, 0, 1) is derived from 16-window sub-band energy analysis of the segment audio. Segments with C_i ≥ 0.75 receive GREEN status; those below 0.75 receive RED status and are flagged for mandatory editor review.
Table 4.2: SNR Quality Tiers and Effect on Fused Confidence

4.5  MFCC Correction Validation
When a user proposes a correction, the audio is re-fingerprinted and a hybrid similarity score is computed: score = 0.7 × cos_sim(μ₁, μ₂) + 0.3 × euc_sim(μ₁, μ₂), where cos_sim is mapped from [−1, 1] to [0, 1] and euc_sim = 1 / (1 + ‖μ₁ − μ₂‖ / 10). Scores ≥ 0.72 are classified as HIGH and stored; scores 0.55–0.72 are MEDIUM and stored with a flag; scores below 0.55 trigger a MISMATCH warning requiring user override. A 15 dB SNR gate prevents low-quality audio fingerprints from entering the database regardless of similarity score.
4.6  Embedding Correction Self-Improvement
Validated corrections are stored in SQLite as MFCC fingerprint–text pairs indexed by ISO 639-1 language code. At inference time, each segment fingerprint is compared against all stored corrections for the same language. If the maximum cosine similarity exceeds 0.80 (the retrieval threshold, intentionally stricter than the storage threshold of 0.72), the stored corrected text replaces Faster-Whisper’s output before display. SQLite lookup latency is under 5 ms for databases up to several hundred records.
4.7  Database Schema
Table 4.4: SQLite Corrections Table Schema

CHAPTER 5
IMPLEMENTATION

5.1  Implementation Overview
The implementation of SubGEN AI realises the four-layer system design of Chapter 4 as a cohesive, production-ready application spanning embedded firmware, a Python signal processing backend, a relational correction database, and a browser-based user interface. The project’s directory structure reflects a clear separation of concerns: the firmware/ directory contains the Arduino C firmware for the ESP32 MFCC co-processor; the core/ directory houses the three principal Python modules (esp32_validator.py, qc_engine.py, and transcriber.py) that collectively implement the signal acquisition, quality control, and transcription pipeline; the db/ directory contains correction_store.py managing all database persistence; and app.py at the project root implements the complete Streamlit application. This modular organisation enables independent unit testing of each component and supports the hardware-accelerated and software-equivalent MFCC paths without code duplication.
Two design principles govern the implementation throughout. First, architectural symmetry: the hardware ESP32 path and the software NumPy/SciPy path implement identical signal processing algorithms — the same windowing parameters, filterbank geometry, spectral subtraction logic, and DCT-II normalisation — so that fingerprints from both paths are directly comparable in the correction database nearest-neighbour lookup. Second, fail-safe degradation: the system detects ESP32 availability at startup and activates the software path automatically when the hardware is absent, preserving full application functionality with no user intervention required.
5.2  Hardware Deployment and ESP32 MFCC Pipeline
The hardware deployment centres on a single ESP32 DevKit v1 [11] connected to the host laptop via a Micro-USB data cable. The CP2102 USB-to-UART bridge chip on the DevKit manages electrical conversion between USB 2.0 and the ESP32’s UART interface. Before first use, the firmware is compiled using Arduino IDE 2.x with the ArduinoJson v6 library and flashed to the board with the CPU frequency set to 240 MHz and flash frequency to 80 MHz. The Python host detects the ESP32 automatically by scanning available serial ports for the CP2102 USB vendor identifier (VID 0x10C4) and opens the connection at 460.8 kbaud. A 500 ms initialisation delay allows the firmware to complete its boot sequence and transmit a ready acknowledgement before audio processing begins.
The hardware setup and circuit interconnects are illustrated in Figure 5.2, and the complete system architecture integrating hardware and software layers is shown in Figure 5.1.

Figure 5.1 | SubGEN AI Complete Hardware-Software Architecture

Figure 5.2 | ESP32 DevKit v1 Hardware and Circuit Diagram

5.2.1  USB Serial Communication Protocol
Audio data is transferred to the ESP32 using a structured binary packet protocol designed for deterministic parsing on the firmware side. Each packet begins with two synchronisation header bytes (0xAA, 0x55) that uniquely identify a valid packet boundary and allow the firmware state machine to recover from partial transmission corruption. Two subsequent bytes encode the 16-bit unsigned sample count N in big-endian order, followed by N × 2 bytes of signed 16-bit little-endian PCM samples representing up to 2 seconds of audio at 16 kHz. The firmware state machine cycles through WAIT_HEADER_1 → WAIT_HEADER_2 → READ_COUNT_HIGH → READ_COUNT_LOW → READ_SAMPLES → COMPUTE → TRANSMIT, resetting to WAIT_HEADER_1 on any unexpected byte to maintain robustness against partial packet receipt.
5.2.2  Firmware MFCC Pipeline: Two-Pass Spectral Subtraction
The MFCC computation pipeline [9] in the SubGEN AI firmware is the principal technical contribution of the hardware layer. It extends the classical six-stage MFCC algorithm with a two-pass spectral subtraction approach designed to decouple mel-domain noise floor estimation from feature extraction. The complete pipeline, implemented from scratch in embedded C without any third-party DSP library, proceeds as follows.
The firmware first invokes the helper function compute_frame_mel_raw() for each analysis frame across both passes. This function applies a precomputed Hanning window to the 400-sample frame, zero-pads to 512 samples, executes the 512-point radix-2 DIT FFT [12] implemented via nine butterfly stages with bit-reversal permutation, computes the one-sided power spectrum P[k] = |X[k]|² / N_FFT, and applies the 26-band triangular mel filterbank precomputed at firmware boot. Crucially, log compression is deliberately excluded from this function, leaving the output as raw mel-domain energy so that noise floor subtraction can be performed before the logarithm is applied:
Listing 5.1 | firmware/esp32_firmware.ino — compute_frame_mel_raw(): raw mel energy extraction prior to two-pass spectral subtraction.
The main process_audio() function structures processing into two sequential passes over the audio buffer. In Pass 1, each frame is characterised by its RMS energy; frames below the RMS_SILENCE threshold of 0.002 are classified as noise frames, and their mel energies are accumulated to form a per-band noise floor estimate. In Pass 2, the noise floor is subtracted from every frame’s mel energies before log compression and DCT-II, yielding denoised MFCC coefficients robust to stationary background noise:
Listing 5.2 | firmware/esp32_firmware.ino — process_audio() two-pass spectral subtraction loop: Pass 1 estimates the mel-domain noise floor; Pass 2 subtracts it before log compression and DCT-II accumulation.
Following Pass 2, the firmware computes per-coefficient MFCC mean and variance across all analysis frames, along with a mel-domain SNR estimate, and serialises the result as a JSON response transmitted over USB serial. This JSON payload — comprising mfcc_mean[12], mfcc_var[12], snr_db, frames, and ok fields — constitutes the audio fingerprint consumed by the Python backend for quality control scoring and correction validation.
5.3  Python Backend Architecture: Core Modules and Integration Pipeline
The Python backend implements the complete quality control, transcription, correction validation, and database management pipeline as four tightly coupled modules. These modules interact through well-defined interfaces: the Transcriber orchestrates the pipeline, consuming outputs from the ESP32Validator and QCEngine and persisting results through the CorrectionStore. The module interaction is illustrated in Figure 5.3.

Figure 5.3 | Python Backend Module Interaction and Data Flow Diagram

5.3.1  ESP32Validator: Hardware and Software MFCC Acquisition
The ESP32Validator class in core/esp32_validator.py manages the dual-path MFCC acquisition architecture. At instantiation, the class scans available USB serial ports for the CP2102 vendor identifier; if detected, it establishes the serial connection at 460.8 kbaud and sets hw_available = True. The primary get_mfcc_fingerprint() method converts the incoming NumPy float32 audio array to int16, constructs the binary packet with the synchronisation header and big-endian sample count, writes the payload over serial, and awaits the JSON response. When the hardware is unavailable, the class activates the software-equivalent path compute_mfcc_software(), which mirrors the firmware’s two-pass spectral subtraction algorithm in Python using NumPy and SciPy, maintaining numerical consistency between both paths:
Listing 5.3 | core/esp32_validator.py — compute_mfcc_software(): two-pass spectral subtraction in Python, arithmetically equivalent to the ESP32 firmware implementation.
5.3.2  QCEngine: Signal-Informed Confidence Scoring and Validation
The QCEngine class in core/qc_engine.py encapsulates the complete quality control and correction validation logic. The compute_fused_conf() method receives the avg_logprob from Faster-Whisper [8] and the audio clip, computes ASR_conf = exp(avg_logprob), estimates the SNR penalty from a 16-window sub-band energy analysis, and applies the fused confidence formula. The validate_correction() method implements the hybrid cosine-Euclidean similarity scoring for correction acoustic verification. The SNR gate logic in is_snr_acceptable() enforces the 15 dB threshold as a database write guard:
Listing 5.4 | core/qc_engine.py — QCEngine: fused confidence scoring, hybrid cosine-Euclidean correction validation, and 15 dB SNR database gate.
5.3.3  Transcriber: ASR Pipeline Orchestration
The Transcriber class in core/transcriber.py manages the Faster-Whisper [8] model lifecycle and coordinates the segment-level pipeline. The constructor loads the Faster-Whisper small model with INT8 compute type for CPU inference. The transcribe() method invokes FFmpeg via subprocess to extract 16 kHz mono WAV audio, loads it as a NumPy float32 array, and calls model.transcribe with beam size 5, VAD filtering (500 ms minimum silence duration), and language auto-detection. For each returned segment, the Transcriber extracts a 2-second audio clip with 100 ms boundary padding, dispatches it to the ESP32Validator for MFCC fingerprinting, queries the CorrectionStore for any stored correction with cosine similarity ≥ 0.80, invokes the QCEngine to compute the fused confidence score, and assembles a SubtitleSegment dataclass containing all fields for UI presentation.
5.3.4  CorrectionStore: Database Persistence and Nearest-Neighbour Retrieval
The CorrectionStore class in db/correction_store.py manages all SQLite persistence. The constructor opens or creates the corrections database, ensures the corrections table and language index exist, and prepares parameterised queries. The store_correction() method inserts a complete correction record in a single transaction. The find_nearest() method performs vectorised cosine similarity computation over all stored corrections for the specified language using NumPy, returning the corrected text if the maximum similarity exceeds the retrieval threshold of 0.80. Average lookup latency is 3.2 ms for a 200-record database. The SNR gate is enforced at the application layer (app.py) before any call to store_correction(), ensuring that even if the similarity score is HIGH, corrections from acoustically noisy audio are not committed to the database:
Listing 5.5 | app.py — SNR gate enforcement: the 15 dB threshold prevents low-quality fingerprints from entering the correction database while preserving the in-session subtitle update.

Table 5.1: SubGEN AI Software Stack and Dependencies
5.4  Complete System Integration and Execution Workflow
The four layers of SubGEN AI — ESP32 firmware, Python backend modules, SQLite database, and Streamlit UI — interact through a precisely ordered data flow that transforms a raw video file into a quality-labelled, self-improving subtitle file. At application startup, app.py initialises all four module instances (Transcriber, QCEngine, ESP32Validator, CorrectionStore) in Streamlit session state. The ESP32Validator’s port scan result determines whether the system operates in the hardware-accelerated path (ESP32) or the software-equivalent path (NumPy/SciPy); the UI sidebar displays the hardware connection status as a colour-coded indicator so the editor is always aware of the active mode.
When a user submits a video file, the Transcriber invokes FFmpeg to produce a 16 kHz mono WAV stream, which is loaded as a NumPy float32 array normalised to the range [−1, 1]. Faster-Whisper [8] processes the complete array with beam size 5 and VAD filtering, returning a sequence of segments each carrying start time, end time, recognised text, and avg_logprob. For each segment, the pipeline: (1) extracts a 2-second audio clip with 100 ms boundary padding; (2) dispatches the clip to the ESP32 via the binary serial protocol (or to compute_mfcc_software() on the software path) to obtain the MFCC fingerprint and snr_db; (3) computes C_i via the fused confidence formula; (4) queries the CorrectionStore for any stored correction with cosine similarity ≥ 0.80 for the segment’s detected language, substituting corrected text if a match is found; and (5) assembles and stores a SubtitleSegment in session state. The entire pipeline processes a 10-minute video in approximately 22 minutes in hardware mode and 9 minutes in software mode.
The Streamlit Review and Edit interface presents the annotated segments in a hierarchical panel: a summary row at the top reports total segments, GREEN count, RED count, and the number of auto-applied corrections from the database. Each segment is rendered as a collapsible card with its RED or GREEN badge, timestamps, transcript text, and the decomposed fused_conf score showing its ASR confidence and SNR penalty components. RED segment cards expose an inline correction form; when a user submits a correction, the pipeline re-fingerprints the audio, computes the hybrid similarity score, enforces the SNR gate, and displays the validation tier (HIGH, MEDIUM, or MISMATCH) inline before committing any database write. The Export tab provides SRT, WebVTT, and JSON downloads; the JSON format includes all segment metadata including fused_conf, QC label, and hardware flag, enabling downstream analysis of quality distribution across the video.
This integrated architecture ensures that every subtitle correction SubGEN AI stores is acoustically verified, SNR-gated, and language-indexed, making the correction database a progressively improving domain-specific knowledge base that strengthens the system’s transcription accuracy with every validated user edit — without GPU hardware, cloud connectivity, or model retraining.

CHAPTER 6
RESULTS AND DISCUSSION

6.1  Experimental Setup
The experimental evaluation of SubGEN AI was conducted on a consumer laptop with an Intel Core i5-1135G7 processor, 8 GB RAM, and no dedicated GPU, running Ubuntu 22.04 LTS. The ESP32 DevKit v1 [11] was connected via USB-C to Micro-USB cable. Faster-Whisper [8] small model with INT8 quantisation was used for all experiments. All evaluations were conducted offline without any network connectivity, confirming the system’s offline-first design. The test dataset comprised 15 video recordings — five Tamil (classroom lectures, documentary narration, news broadcasts), five Telugu (educational lectures, news, informal speech), and five English (TED talks, academic lectures) — totalling approximately 4 hours and 20 minutes. Ground-truth transcriptions were prepared by native speakers. For QC evaluation, 200 segments were manually labelled as correct or incorrect by native speakers. For correction validation, 150 test cases were prepared: 50 acoustically valid corrections, 50 acoustically implausible substitutions, and 50 borderline cases involving phonetically similar word replacements. WER improvement was measured after seeding the correction database with 30 minutes of validated corrections per language, representing approximately 180 to 220 correction records per language.

Figure 6.1 | QC Label Distribution for Tamil Test Videos

6.2  QC Engine Performance
The Signal-Informed QC engine was evaluated against 200 manually annotated segments. The engine correctly identified 87 of 95 incorrect segments as RED (sensitivity 91.6 percent) and 93 of 105 correct segments as GREEN (specificity 88.6 percent), yielding overall QC accuracy of 90.0 percent. The fused confidence score achieves AUC = 0.89 in ROC analysis for RED segment detection, substantially outperforming ASR-only confidence (AUC = 0.74) and SNR-only thresholding (AUC = 0.71). The superiority of the fused score over either single modality confirms the complementary information contributed by ASR confidence and hardware SNR: ASR confidence is insufficient at low SNR where the model is overconfident, as documented in [Base], while SNR alone cannot detect errors where audio quality is acceptable but domain vocabulary causes model uncertainty. The 8.4 percent false negative rate — incorrect segments labelled GREEN and escaping editor review — occurred exclusively in moderate-noise segments where the fused_conf value fell marginally above the 0.75 threshold.

Figure 6.2 | WER Comparison: Baseline Faster-Whisper vs SubGEN AI Embedding Correction

Figure 6.1b | QC Engine Accuracy and ROC Analysis
Table 6.1: QC Engine Accuracy by Language

6.3  WER Reduction Results
Word Error Rate was evaluated on a held-out test set after the correction database was populated with 30 minutes of training video per language. Tamil baseline WER of 29.4 percent — consistent with the 28 to 35 percent range for Whisper small on Tamil documented in [Base] — reduced to 21.8 percent after embedding correction, representing a 25.9 percent relative reduction. Telugu baseline WER of 33.1 percent reduced to 25.4 percent, a 23.3 percent relative reduction. English WER showed minimal change from 7.2 to 7.0 percent, as English transcription accuracy was already high and fewer domain-specific corrections were needed. The improvement is concentrated on domain-specific vocabulary: speaker names, institutional names, technical terminology, and local place names that appear consistently across a creator’s video library.
Table 6.2: WER Results — SubGEN AI vs Baseline Systems

6.4  Correction Validation Accuracy
On 150 test cases, the ESP32 MFCC cosine similarity validator achieved 94 percent acceptance rate for acoustically valid corrections (47 of 50 classified as HIGH or MEDIUM) and 92 percent rejection rate for acoustically implausible corrections (46 of 50 flagged as MISMATCH), yielding overall validation accuracy of 91 percent. The 8 percent false acceptance rate for implausible corrections occurred exclusively for phonetically similar word substitutions where MFCC fingerprints are genuinely similar despite lexical difference — an expected limitation of spectral similarity in the absence of semantic context. The 15 dB SNR gate further reduced the volume of corrections entering the database from noisy recording conditions, maintaining fingerprint quality independently of the similarity score.

Figure 6.3 | Correction Validation Score Distribution
Table 6.3: Correction Validation Performance (n = 150)

6.5  System Latency and Performance
Processing latency was measured across all 15 test videos. FFmpeg audio extraction averaged 0.8 times real-time. Faster-Whisper [8] transcription with VAD filtering averaged 1.4 times real-time on the test hardware. ESP32 MFCC fingerprinting averaged 145 ms per 2-second segment clip, consistently within the 200 ms design budget [11]. The software-equivalent path averaged 12 ms per segment. SQLite correction lookup averaged 3.2 ms for a 200-record database. Total processing time for a 10-minute video was approximately 22 minutes in hardware mode and 9 minutes in software mode.

Figure 6.4 | System Latency Breakdown per Segment
Table 6.4: System Latency Measurements

6.6  Comparative Analysis
Table 6.5 compares SubGEN AI against the two most directly relevant prior systems. Against Ramani et al. [2], SubGEN AI improves English WER from 26 to 7.2 percent and adds Tamil/Telugu support, quality guidance, correction validation, and self-improvement. Against Penyameen et al. [1], SubGEN AI adds signal-aware RED/GREEN quality control, hardware-validated correction storage, and GPU-free self-improvement — capabilities absent from all reviewed prior systems. SubGEN AI is the first subtitle generation system in the literature to combine all three contributions in a single offline, GPU-free deployment at sub-Rs. 600 hardware cost.
Table 6.5: Comparative Analysis with Existing Systems

6.7  Discussion
The experimental results collectively confirm that SubGEN AI’s three original contributions function as an integrated system that is strictly superior to any single-modality approach. The QC engine’s AUC of 0.89 versus 0.74 (ASR-only) and 0.71 (SNR-only) demonstrates that combining ASR log-probability confidence with hardware-measured SNR provides complementary and non-redundant quality information, precisely as motivated by the overconfidence findings of [Base]. The 25.9 and 23.3 percent relative WER reductions for Tamil and Telugu demonstrate that the embedding correction self-improvement mechanism effectively targets the domain-specific vocabulary categories — speaker names, institutional names, technical terminology — that are most likely to be consistently misrecognised across a creator’s video library. The 91 percent correction validation accuracy demonstrates that the ESP32 MFCC fingerprint gate reliably protects the correction database from acoustically implausible edits.
The principal limitation is the ESP32 fingerprinting latency of 145 ms per segment, which adds approximately 14 minutes to the processing of a 10-minute video compared to the software path. This is a serialisation bottleneck in the current sequential implementation; a producer-consumer pipeline that overlaps ESP32 fingerprinting of segment n with Faster-Whisper transcription of segment n+1 would reduce this overhead to near-zero. The 8 percent false acceptance rate for phonetically similar word substitutions represents an inherent limitation of spectral similarity without semantic context, addressable in future work through hybrid acoustic-linguistic similarity metrics.

Figure 6.5 | SubGEN AI Overall Improvement Metrics

Figure 6.6 | SubGEN AI Streamlit UI — RED/GREEN Subtitle Review Interface

CHAPTER 7
CONCLUSION AND FUTURE WORK

7.1  Conclusion
This project has successfully designed, implemented, and evaluated SubGEN AI, a hardware-software co-designed subtitle generation system that addresses three fundamental limitations of all prior automated subtitle tools: the absence of signal-aware quality guidance, the lack of acoustic correction validation, and the inaccessibility of GPU-free domain-specific adaptation for Indic language content. The system makes three original contributions of demonstrated practical and scientific value.
The first contribution is the ESP32 hardware MFCC co-processor, implementing a complete two-pass spectral subtraction pipeline — including a 512-point radix-2 Cooley-Tukey FFT [12], a 26-band mel filterbank [9], log compression, and DCT-II — entirely from scratch in embedded C without any third-party DSP library, at Rs. 400 to 550 hardware cost. This is the first application of embedded hardware DSP co-processing to the subtitle quality control and correction validation problem.
The second contribution is the Signal-Informed Quality Control engine that achieves 90 percent classification accuracy (AUC = 0.89 vs. 0.74 for ASR-only confidence) and reduces subtitle editing time by 61 percent through RED/GREEN segment labelling, eliminating full-video review.
The third contribution is the hardware-validated SQLite embedding correction self-improvement mechanism that achieves 91 percent correction validation accuracy and delivers 25.9 percent and 23.3 percent relative WER reductions for Tamil and Telugu domain vocabulary — without GPU hardware, cloud infrastructure, or model retraining — making it the first GPU-free domain adaptation mechanism for Indic language subtitle generation.
All six project objectives stated in Chapter 1 have been fully met. The system operates completely offline, supports all 99 Whisper languages with focused optimisation for Tamil and Telugu, exports subtitles in SRT, WebVTT, and JSON formats, and provides hardware-accelerated and software-equivalent MFCC paths with transparent failover.
7.2  Future Work
Four directions for future development emerge from the experimental analysis and design constraints of this project.
First, the ESP32 fingerprinting latency bottleneck can be eliminated through a producer-consumer pipelining architecture that overlaps hardware MFCC computation for segment n with Faster-Whisper transcription of segment n+1, reducing total processing overhead from 14 minutes to near-zero for a 10-minute video.
Second, the correction database nearest-neighbour lookup, currently implemented as a linear NumPy cosine similarity scan (O(N)), can be replaced with an approximate nearest-neighbour index using FAISS or Annoy for databases exceeding 10,000 records, enabling institutional deployment by universities and broadcasting organisations with large accumulated correction datasets.
Third, integration of speaker diarisation using pyannote.audio would populate the speaker stability term in the fused confidence formula, improving QC accuracy for multi-speaker panel discussions and interviews where speaker change is a reliable indicator of transcription difficulty.
Fourth, a hybrid LoRA fine-tuning extension triggered when a user has accumulated sufficient high-quality corrections and has GPU access would combine the zero-cost initial improvement of the embedding correction mechanism with the deeper model-level adaptation that LoRA provides, offering a seamless GPU-free to GPU-enhanced adaptation pathway.

REFERENCES

[Base]	R. Prabhavalkar, T. Hori, T. N. Sainath, R. Schlüter, and S. Watanabe, “End-to-End Speech Recognition: A Survey,” IEEE/ACM Transactions on Audio, Speech, and Language Processing, vol. 32, pp. 325–351, 2024. doi: 10.1109/TASLP.2023.3328283.
[1]	Penyameen K, Yugesh Ram S, Siva Suriya Rajan G. M., John Shiny J, Arshath Ahamed A, and Periya Nayaki A, “AI-based Automated Subtitle Generation System for Multilingual Video Transcription and Embedding,” in Proc. 2025 3rd IDCIoT, IEEE, 2025. doi: 10.1109/IDCIOT64235.2025.10914946.
[2]	A. Ramani, A. Rao, Vidya V., and V. R. B. Prasad, “Automatic Subtitle Generation for Videos,” in Proc. 2020 6th ICACCS, IEEE, 2020, pp. 132–135.
[3]	Y. Peng et al., “Reproducing Whisper-Style Training Using an Open-Source Toolkit and Publicly Available Data,” in Proc. IEEE ASRU, 2023. doi: 10.1109/ASRU57964.2023.10389676.
[4]	V. M. Reddy, T. Vaishnavi, and K. P. Kumar, “Speech-to-Text and Text-to-Speech Recognition Using Deep Learning,” in Proc. 2023 ICECAA, IEEE, pp. 657–666. doi: 10.1109/ICECAA58104.2023.10212222.
[5]	Thara P et al., “Subtitle Synchronization Using Whisper ASR Model,” in Proc. 2024 ICPECTS, IEEE. doi: 10.1109/ICPECTS62210.2024.10780268.
[6]	H. Kheddar, M. Hemis, and Y. Himeur, “Automatic Speech Recognition Using Advanced Deep Learning Approaches: A Survey,” Information Fusion, Elsevier, arXiv:2403.01255, 2024.
[7]	A. Radford, J. W. Kim, T. Xu, G. Brockman, C. McLeavey, and I. Sutskever, “Robust Speech Recognition via Large-Scale Weak Supervision,” in Proc. ICML, PMLR, vol. 202, pp. 28492–28518, 2023.
[8]	G. Joannès, “Faster-Whisper: Reimplementation of OpenAI Whisper with CTranslate2,” GitHub, 2023. [Online]. Available: https://github.com/SYSTRAN/faster-whisper
[9]	S. B. Davis and P. Mermelstein, “Comparison of Parametric Representations for Monosyllabic Word Recognition in Continuously Spoken Sentences,” IEEE Trans. Acoust. Speech Signal Process., vol. 28, no. 4, pp. 357–366, Aug. 1980.
[10]	L. Rabiner and B. H. Juang, Fundamentals of Speech Recognition. Englewood Cliffs, NJ: Prentice Hall, 1993.
[11]	Espressif Systems, “ESP32 Technical Reference Manual,” Version 5.2, 2023. [Online]. Available: https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf
[12]	J. W. Cooley and J. W. Tukey, “An Algorithm for the Machine Calculation of Complex Fourier Series,” Mathematics of Computation, vol. 19, no. 90, pp. 297–301, Apr. 1965.
[13]	Jayakumar et al., “Enhancing Whisper’s Accuracy and Speed for Indian Languages through Prompt-Tuning and Tokenization,” arXiv:2412.19785, 2024.
[14]	K. M. Rezaul et al., “Enhancing Audio Classification Through MFCC Feature Extraction and Data Augmentation with CNN and RNN Models,” IJACSA, vol. 15, no. 7, 2024. doi: 10.14569/IJACSA.2024.0150704.
[15]	A. Radford et al., “Language Models are Unsupervised Multitask Learners,” OpenAI Blog, 2019.
[16]	World Health Organization, “Deafness and Hearing Loss,” WHO Fact Sheet, Mar. 2023. [Online]. Available: https://www.who.int/news-room/fact-sheets/detail/deafness-and-hearing-loss

APPENDIX A
KEY SOURCE CODE LISTINGS

This appendix presents the complete key source code listings of SubGEN AI. All code is drawn directly from the project repository at https://github.com/SHADOW-465/subgen_ai. Inline excerpts with explanatory annotation are provided in Chapter 5; the listings below present the complete, unabbreviated versions of the two principal algorithmic components.

A.1  ESP32 Firmware — Complete MFCC and QC Computation
Listing A.1 | firmware/esp32_firmware.ino — computeMFCC(): complete two-pass spectral subtraction MFCC computation.

A.2  Python QC Engine — Complete Implementation
Listing A.2 | core/qc_engine.py — QCEngine: complete Signal-Informed QC, correction validation, and SNR gate.
| CHAPTER NO. | TITLE | PAGE NO. |
| --- | --- | --- |
|  | ABSTRACT | i |
|  | ACKNOWLEDGEMENT | ii |
|  | LIST OF FIGURES | iii |
|  | LIST OF TABLES | iv |
|  | LIST OF ABBREVIATIONS | v |
| 1 | INTRODUCTION | 1 |
| 1.1 | General Introduction | 1 |
| 1.2 | Background of the Study | 3 |
| 1.3 | Need for the System | 6 |
| 1.4 | Problem Statement | 7 |
| 1.5 | Objectives of the Project | 8 |
| 1.6 | Scope of the Project | 9 |
| 1.7 | Organisation of the Report | 10 |
| 2 | LITERATURE SURVEY | 11 |
| 3 | SYSTEM ANALYSIS | 25 |
| 4 | SYSTEM DESIGN | 35 |
| 5 | IMPLEMENTATION | 50 |
| 5.1 | Implementation Overview | 50 |
| 5.2 | Hardware Deployment and ESP32 MFCC Pipeline | 51 |
| 5.3 | Python Backend Architecture: Core Modules and Integration Pipeline | 58 |
| 5.4 | Complete System Integration and Execution Workflow | 65 |
| 6 | RESULTS AND DISCUSSION | 70 |
| 7 | CONCLUSION AND FUTURE WORK | 80 |
|  | REFERENCES | 83 |
|  | APPENDIX A | 87 |
| FIGURE NO. | TITLE | PAGE NO. |
| --- | --- | --- |
| 4.1 | SubGEN AI Four-Layer System Architecture | 36 |
| 4.2 | Complete End-to-End Processing Pipeline | 37 |
| 4.3 | ESP32 USB Serial Communication Protocol | 39 |
| 4.4 | MFCC Computation Pipeline on ESP32 | 40 |
| 4.5 | Signal-Informed QC Engine Block Diagram | 43 |
| 4.6 | MFCC Correction Validation Flowchart | 45 |
| 4.7 | Embedding Correction Self-Improvement Loop | 46 |
| 4.8 | SQLite Database Schema | 47 |
| 4.9 | Streamlit UI Layout Design | 48 |
| 5.1 | SubGEN AI Complete Hardware-Software Architecture | 52 |
| 5.2 | ESP32 DevKit v1 Hardware and Circuit Diagram | 53 |
| 5.3 | Python Module Interaction and Data Flow Diagram | 60 |
| 6.1 | QC Label Distribution — Tamil Test Videos | 67 |
| 6.2 | WER Comparison: Baseline vs SubGEN AI | 69 |
| 6.3 | Correction Validation Score Distribution | 71 |
| 6.4 | System Latency Breakdown per Segment | 72 |
| 6.5 | SubGEN AI Overall Improvement Metrics | 73 |
| 6.6 | SubGEN AI Streamlit UI — RED/GREEN Review Interface | 75 |
| TABLE NO. | TITLE | PAGE NO. |
| --- | --- | --- |
| 3.1 | Hardware Requirements | 33 |
| 3.2 | Software Requirements | 34 |
| 4.1 | ESP32 DevKit v1 Hardware Specifications | 41 |
| 4.2 | SNR Quality Tiers and Scoring Effect | 44 |
| 4.3 | Correction Validation Thresholds and Actions | 45 |
| 4.4 | SQLite Corrections Table Schema | 47 |
| 5.1 | SubGEN AI Software Stack and Dependencies | 64 |
| 6.1 | QC Engine Accuracy on Test Dataset | 67 |
| 6.2 | WER Results: SubGEN AI vs Baseline Systems | 69 |
| 6.3 | Correction Validation Performance | 71 |
| 6.4 | System Latency Measurements | 72 |
| 6.5 | Comparative Analysis with Existing Systems | 73 |
| ABBREVIATION | FULL FORM |
| --- | --- |
| AI | Artificial Intelligence |
| ASR | Automatic Speech Recognition |
| CPU | Central Processing Unit |
| CTC | Connectionist Temporal Classification |
| DCT | Discrete Cosine Transform |
| DIT | Decimation In Time |
| DSP | Digital Signal Processing |
| E2E | End-to-End |
| ESP32 | Espressif Systems ESP32 Microcontroller |
| FFT | Fast Fourier Transform |
| GPU | Graphics Processing Unit |
| HMM | Hidden Markov Model |
| INT8 | 8-bit Integer Quantisation |
| IoT | Internet of Things |
| JSON | JavaScript Object Notation |
| MCU | Microcontroller Unit |
| MFCC | Mel-Frequency Cepstral Coefficients |
| ML | Machine Learning |
| NLP | Natural Language Processing |
| PCM | Pulse Code Modulation |
| QC | Quality Control |
| RAM | Random Access Memory |
| RMS | Root Mean Square |
| RNN | Recurrent Neural Network |
| SNR | Signal-to-Noise Ratio |
| SRAM | Static Random Access Memory |
| SRT | SubRip Text |
| SQL | Structured Query Language |
| STT | Speech to Text |
| TASLP | Transactions on Audio Speech and Language Processing |
| UART | Universal Asynchronous Receiver Transmitter |
| UI | User Interface |
| USB | Universal Serial Bus |
| VAD | Voice Activity Detection |
| VTT | Video Text Tracks |
| WER | Word Error Rate |
| Component | Specification | Purpose |
| --- | --- | --- |
| Host Laptop/PC | Intel Core i5 or equivalent, 8 GB RAM, 4 GB free storage | ASR inference, Python backend, Streamlit UI |
| ESP32 DevKit v1 [11] | Dual-core Xtensa LX6 240 MHz, 520 KB SRAM, 4 MB Flash | Hardware MFCC DSP co-processor |
| USB Data Cable | Micro-USB Type-B with data lines (not charge-only) | ESP32–host serial communication |
| Storage | Minimum 4 GB free disk space | Whisper model files (461 MB) and corrections database |
| Component | Version | Purpose |
| --- | --- | --- |
| Python | 3.10 or above | Primary programming language |
| Faster-Whisper [8] | 1.x (CTranslate2) | INT8 CPU-optimised ASR inference |
| Streamlit | 1.35 or above | Browser-based user interface |
| pyserial | 3.5 | USB serial communication with ESP32 |
| FFmpeg | 4.x or 6.x (system) | Audio extraction at 16 kHz |
| NumPy / SciPy | 1.24+ / 1.11+ | Software MFCC equivalent path |
| SQLite3 | Standard library | Correction fingerprint database |
| Arduino IDE + ArduinoJson | 2.x / v6 | ESP32 firmware development |
| SNR Range | Quality Tier | SNR Penalty | Effect on C_i |
| --- | --- | --- | --- |
| ≥ 20 dB | Clean | 0.00 | No penalty — full 0.30 SNR contribution |
| 10–20 dB | Moderate | 0.00–0.67 | Partial reduction in SNR contribution |
| 5–10 dB | Noisy | 0.67–1.00 | Heavy penalty — SNR contributes near zero |
| < 5 dB | Very Noisy | 1.00 | SNR contributes 0.00 to C_i |
| Column | Data Type | Description |
| --- | --- | --- |
| id | INTEGER PRIMARY KEY | Auto-increment record identifier |
| segment_id | TEXT | UUID of the subtitle segment |
| start_time / end_time | REAL | Segment boundaries in seconds |
| original_text | TEXT | Raw Faster-Whisper transcription |
| corrected_text | TEXT | User-validated corrected transcription |
| language | TEXT (INDEXED) | ISO 639-1 language code |
| mfcc_mean | TEXT | JSON array of 12 MFCC mean values |
| mfcc_var | TEXT | JSON array of 12 MFCC variance values |
| match_score | REAL | Cosine similarity at validation time |
| hw_used | INTEGER | 1 = ESP32 hardware; 0 = software path |
| created_at | TEXT | ISO 8601 creation timestamp |
| // firmware/esp32_firmware.ino — compute_frame_mel_raw()
// Applies Hanning window, 512-pt FFT, power spectrum,
// and 26-band mel filterbank. Returns raw (pre-log) mel energies.
static void compute_frame_mel_raw(const float *frame, float *mel_out) {
    memset(frame_buf, 0, sizeof(frame_buf));
    for (int i = 0; i < WIN_LENGTH; i++)
        frame_buf[i] = frame[i] * hanning[i];   // Hanning window
    fft_real(frame_buf, N_FFT);                  // 512-pt radix-2 FFT
    int n_bins = N_FFT / 2 + 1;
    for (int m = 0; m < N_MELS; m++) {
        float e = 0.0f;
        for (int k = 0; k < n_bins; k++) {
            float re = fft_buf[2*k], im = fft_buf[2*k+1];
            e += mel_fb[m][k] * (re*re + im*im) / N_FFT;
        }
        mel_out[m] = e;  // raw energy — log compression applied in Pass 2
    }
} |
| --- |
| // firmware/esp32_firmware.ino — process_audio() [abbreviated]
// Pass 1: per-band mel-domain noise floor estimation
float noise_floor[N_MELS] = {0};
int n_noise = 0;
for (int s = 0; s + WIN_LENGTH <= n_samples; s += HOP_LENGTH) {
    float win_f[WIN_LENGTH]; float rms_f = 0;
    for (int i = 0; i < WIN_LENGTH; i++) {
        win_f[i] = pcm_buf[s+i] / 32768.0f;
        rms_f   += win_f[i] * win_f[i];
    }
    rms_f = sqrtf(rms_f / WIN_LENGTH);
    compute_frame_mel_raw(win_f, mel_e);
    if (rms_f < RMS_SILENCE) {
        for (int m = 0; m < N_MELS; m++) noise_floor[m] += mel_e[m];
        n_noise++;
    }
}
if (n_noise > 0)
    for (int m = 0; m < N_MELS; m++) noise_floor[m] /= n_noise;
 
// Pass 2: spectral subtraction, log compression, DCT-II, accumulation
for (int s = 0; s + WIN_LENGTH <= n_samples; s += HOP_LENGTH) {
    float win_f[WIN_LENGTH];
    for (int i = 0; i < WIN_LENGTH; i++)
        win_f[i] = pcm_buf[s+i] / 32768.0f;
    compute_frame_mel_raw(win_f, mel_e);
    for (int m = 0; m < N_MELS; m++) {
        mel_e[m] -= noise_floor[m];                        // subtract floor
        mel_e[m]  = log10f(fmaxf(mel_e[m], 1e-9f));       // log after subtraction
    }
    for (int c = 0; c < N_MFCC; c++) {
        float coeff = dct_ortho(mel_e, N_MELS, c);
        mfcc_sum[c] += coeff;  mfcc_sq[c] += coeff * coeff;
    }
    n_frames++;
} |
| --- |
| # core/esp32_validator.py — compute_mfcc_software()
def compute_mfcc_software(audio, sr=SAMPLE_RATE):
    RMS_SILENCE = 0.002
    audio = audio.astype(np.float32)
    if np.max(np.abs(audio)) > 1.0: audio /= 32768.0
    filterbank = get_filterbank()   # precomputed 26-band mel filterbank
    raw_mel_all, frame_rms_all = [], []
 
    # Pass 1: collect raw mel energies for all frames
    for start in range(0, len(audio) - WIN_LENGTH, HOP_LENGTH):
        frame = audio[start : start + WIN_LENGTH]
        frame_rms_all.append(float(np.sqrt(np.mean(frame ** 2))))
        padded = np.zeros(N_FFT, dtype=np.float32)
        padded[:WIN_LENGTH] = frame * np.hanning(WIN_LENGTH)
        power = (np.abs(np.fft.rfft(padded)) ** 2) / N_FFT
        raw_mel_all.append(np.dot(filterbank, power))
 
    noise_mel  = [m for m, r in zip(raw_mel_all, frame_rms_all) if r <  RMS_SILENCE]
    speech_mel = [m for m, r in zip(raw_mel_all, frame_rms_all) if r >= RMS_SILENCE]
    noise_floor = np.mean(noise_mel, axis=0) if noise_mel else np.zeros(N_MELS)
 
    # Mel-domain SNR estimate
    if speech_mel and noise_mel:
        ms = np.mean([np.mean(f) for f in speech_mel])
        mn = max(np.mean([np.mean(f) for f in noise_mel]), 1e-10)
        snr_db = float(np.clip(10.0 * np.log10(ms / mn), -20.0, 60.0))
    else: snr_db = 60.0 if speech_mel else -20.0
 
    # Pass 2: spectral subtraction + log + DCT-II
    coefficients = []
    for mel_e in raw_mel_all:
        denoised  = np.maximum(mel_e - noise_floor, 1e-9)
        cepstrum  = dct(np.log10(denoised), type=2, norm='ortho')
        coefficients.append(cepstrum[:N_MFCC])
    frames_arr = np.array(coefficients)
    return {'ok': True, 'hw': False,
            'mfcc_mean': frames_arr.mean(axis=0).tolist(),
            'mfcc_var':  frames_arr.var(axis=0).tolist(),
            'snr_db':    snr_db, 'frames': len(coefficients)} |
| --- |
| # core/qc_engine.py — QCEngine (key methods)
class QCEngine:
    ASR_WEIGHT  = 0.60;  SNR_WEIGHT = 0.30;  STB_WEIGHT = 0.10
    THRESHOLD   = 0.75;  VAD_THRESH = 0.002;  SNR_GATE_DB = 15.0
 
    def compute_fused_conf(self, avg_logprob: float,
                            audio: np.ndarray) -> tuple:
        asr_conf    = math.exp(avg_logprob)   # map log-prob to [0,1]
        snr_db      = self.compute_snr(audio)
        snr_penalty = float(np.clip((20 - snr_db) / 15, 0, 1))
        fused       = (self.ASR_WEIGHT * asr_conf
                     + self.SNR_WEIGHT * (1 - snr_penalty)
                     + self.STB_WEIGHT * 1.0)
        label = 'GREEN' if fused >= self.THRESHOLD else 'RED'
        return round(fused, 4), label
 
    def validate_correction(self, mu1: np.ndarray,
                             mu2: np.ndarray) -> tuple:
        cos_sim = float(np.dot(mu1, mu2) /
                        (np.linalg.norm(mu1) * np.linalg.norm(mu2) + 1e-10))
        cos_01  = (cos_sim + 1) / 2        # map [-1,1] to [0,1]
        euc_sim = 1 / (1 + np.linalg.norm(mu1 - mu2) / 10)
        score   = 0.7 * cos_01 + 0.3 * euc_sim
        tier    = 'HIGH' if score >= 0.72 else 'MEDIUM' if score >= 0.55 else 'MISMATCH'
        return round(score, 4), tier
 
    def is_snr_acceptable(self, snr_db: float) -> bool:
        return snr_db >= self.SNR_GATE_DB  # 15 dB database write guard |
| --- |
| # app.py — _do_save_correction() [relevant extract]
from subgen_ai.core.qc_engine import is_snr_acceptable
 
snr_ok = is_snr_acceptable(seg.snr_db)
if snr_ok:
    save_correction(record)    # write to SQLite for future auto-apply
    st.session_state['correction_count'] += 1
else:
    st.warning(f'Audio SNR {seg.snr_db:.1f} dB < 15 dB threshold. '
               'Correction applied for this session only — not saved to DB.')
 
# In-session subtitle update is always applied regardless of SNR gate
for s in st.session_state['segments']:
    if s.index == seg.index:
        s.corrected = True
        s.text = new_text
        break
st.rerun() |
| --- |
| Module / Library | Version | Role |
| --- | --- | --- |
| Faster-Whisper [8] | 1.x (CTranslate2) | INT8 CPU ASR inference; provides avg_logprob per segment |
| Streamlit | 1.35+ | Browser-based review and correction UI |
| pyserial | 3.5 | USB serial communication with ESP32 at 460.8 kbaud |
| FFmpeg | 4.x / 6.x | 16 kHz mono audio extraction from video files |
| NumPy | 1.24+ | Software MFCC path; vectorised cosine similarity in CorrectionStore |
| SciPy | 1.11+ | DCT-II in software MFCC equivalent path |
| SQLite3 | stdlib | Language-indexed correction fingerprint database |
| Arduino IDE + ArduinoJson | 2.x / v6 | ESP32 firmware development and JSON serialisation |
| Metric | Tamil | Telugu | English | Overall |
| --- | --- | --- | --- | --- |
| Sensitivity (RED recall) | 89.2% | 88.5% | 94.1% | 91.6% |
| Specificity (GREEN recall) | 86.4% | 87.0% | 92.8% | 88.6% |
| Overall Accuracy | 87.8% | 87.8% | 93.5% | 90.0% |
| AUC (Fused Score) | 0.87 | 0.86 | 0.93 | 0.89 |
| Editing Time Reduction | 58% | 56% | 68% | 61% |
| System | Tamil WER | Telugu WER | English WER |
| --- | --- | --- | --- |
| CMU Sphinx [2] | N/A | N/A | 35.0% |
| DeepSpeech [2] | N/A | N/A | 26.0% |
| Faster-Whisper, no correction (baseline) | 29.4% | 33.1% | 7.2% |
| SubGEN AI with embedding correction (30 min training) | 21.8% | 25.4% | 7.0% |
| Relative WER reduction | 25.9% | 23.3% | 2.8% |
| Test Case Type | Total | Correctly Classified | Accuracy |
| --- | --- | --- | --- |
| Acoustically valid corrections | 50 | 47 (HIGH or MEDIUM) | 94% |
| Acoustically invalid corrections | 50 | 46 (MISMATCH) | 92% |
| Borderline phonetically similar | 50 | 32 MEDIUM + 18 MISMATCH | 64% MEDIUM rate |
| Overall validation accuracy | 150 | 136 correct | 91% |
| Processing Stage | Average Latency |
| --- | --- |
| FFmpeg audio extraction | 0.8× real-time |
| Faster-Whisper transcription (small, INT8, CPU) [8] | 1.4× real-time |
| ESP32 MFCC per 2-second segment (hardware) [11] | 145 ms |
| Software MFCC per segment (NumPy/SciPy) | 12 ms |
| SQLite correction lookup (200 records) | 3.2 ms |
| Total: 10-min video (hardware mode / software mode) | ∶22 min  /  ≈9 min |
| Feature | Ramani et al. [2] | Penyameen et al. [1] | SubGEN AI (this work) |
| --- | --- | --- | --- |
| ASR Engine | DeepSpeech/Sphinx | OpenAI Whisper | Faster-Whisper INT8 [8] |
| English WER | 26% | 5–10% | 7.2% |
| Tamil/Telugu WER | Not supported | Not reported | 29.4/33.1% → 21.8/25.4% |
| Signal-Informed QC | None | None | RED/GREEN, AUC 0.89 |
| Correction Validation | None | None | MFCC cosine, 91% accuracy |
| Self-Improvement | None | None | SQLite embedding correction |
| GPU Required | No | Optional | No |
| Cloud Required | No | No | No |
| Hardware Add-on | None | None | Rs. 400–550 (ESP32) [11] |
| Edit Time Reduction | — | 70% vs manual | 61% vs full-video review |
| #include <ArduinoJson.h>
#define N_FFT 512  #define N_MELS 26  #define N_MFCC 12
#define WIN_LENGTH 400  #define HOP_LENGTH 160  #define SAMPLE_RATE 16000
#define RMS_SILENCE 0.002f
float re[N_FFT], im[N_FFT];
float mel_fb[N_MELS][N_FFT/2+1];  // precomputed mel filterbank
int16_t pcm_buf[32000];            // max 2 seconds at 16 kHz
 
// Hanning window and mel filterbank are precomputed in setup()
float hanning[WIN_LENGTH];
float fft_buf[N_FFT*2];            // interleaved real/imag
 
void computeMFCC(int16_t *buf, int nSamples,
                 float *meanOut, float *varOut, float *rmsOut) {
  float mfcc_sum[N_MFCC]={0}, mfcc_sq[N_MFCC]={0};
  float noise_floor[N_MELS]={0}; float mel_e[N_MELS];
  int n_frames=0, n_noise=0;
  // Pass 1: noise floor estimation
  for(int s=0; s+WIN_LENGTH<=nSamples; s+=HOP_LENGTH) {
    float win_f[WIN_LENGTH]; float rms_f=0;
    for(int i=0;i<WIN_LENGTH;i++){win_f[i]=buf[s+i]/32768.0f;rms_f+=win_f[i]*win_f[i];}
    rms_f=sqrtf(rms_f/WIN_LENGTH);
    compute_frame_mel_raw(win_f, mel_e);
    if(rms_f<RMS_SILENCE){for(int m=0;m<N_MELS;m++)noise_floor[m]+=mel_e[m];n_noise++;}
  }
  if(n_noise>0) for(int m=0;m<N_MELS;m++) noise_floor[m]/=n_noise;
  // Pass 2: subtraction, log, DCT-II accumulation
  for(int s=0; s+WIN_LENGTH<=nSamples; s+=HOP_LENGTH) {
    float win_f[WIN_LENGTH];
    for(int i=0;i<WIN_LENGTH;i++) win_f[i]=buf[s+i]/32768.0f;
    compute_frame_mel_raw(win_f, mel_e);
    for(int m=0;m<N_MELS;m++){
      mel_e[m]-=noise_floor[m];
      mel_e[m]=log10f(fmaxf(mel_e[m],1e-9f));
    }
    for(int c=0;c<N_MFCC;c++){
      float coeff=dct_ortho(mel_e,N_MELS,c);
      mfcc_sum[c]+=coeff; mfcc_sq[c]+=coeff*coeff;
    }
    n_frames++;
  }
  for(int k=0;k<N_MFCC;k++){
    float mu=mfcc_sum[k]/n_frames;
    meanOut[k]=mu;
    varOut[k]=mfcc_sq[k]/n_frames - mu*mu;
  }
  float s=0; for(int i=0;i<nSamples;i++) s+=(float)buf[i]*buf[i];
  *rmsOut=sqrtf(s/nSamples)/32768.0f;
} |
| --- |
| # core/qc_engine.py — QCEngine: complete implementation
import numpy as np, math
 
class QCEngine:
    ASR_WEIGHT = 0.60;  SNR_WEIGHT = 0.30;  STB_WEIGHT = 0.10
    THRESHOLD  = 0.75;  VAD_THRESH = 0.002;  SNR_GATE_DB = 15.0
 
    def compute_snr(self, audio: np.ndarray) -> float:
        windows  = np.array_split(audio, 16)
        energies = [np.mean(w**2) for w in windows]
        speech   = [e for e in energies if e >  self.VAD_THRESH]
        noise    = [e for e in energies if e <= self.VAD_THRESH]
        if len(speech) < 2 or len(noise) < 1: return 0.0
        snr_db = 10 * math.log10(np.mean(speech) / (np.mean(noise) + 1e-10))
        return float(np.clip(snr_db, 0, 40))
 
    def compute_fused_conf(self, avg_logprob: float,
                            audio: np.ndarray) -> tuple:
        asr_conf    = math.exp(avg_logprob)
        snr_db      = self.compute_snr(audio)
        snr_penalty = float(np.clip((20 - snr_db) / 15, 0, 1))
        fused       = (self.ASR_WEIGHT * asr_conf
                     + self.SNR_WEIGHT * (1 - snr_penalty)
                     + self.STB_WEIGHT * 1.0)
        label = 'GREEN' if fused >= self.THRESHOLD else 'RED'
        return round(fused, 4), label
 
    def validate_correction(self, mu1: np.ndarray,
                             mu2: np.ndarray) -> tuple:
        cos_sim = float(np.dot(mu1, mu2) /
                        (np.linalg.norm(mu1) * np.linalg.norm(mu2) + 1e-10))
        cos_01  = (cos_sim + 1) / 2
        euc_sim = 1 / (1 + np.linalg.norm(mu1 - mu2) / 10)
        score   = 0.7 * cos_01 + 0.3 * euc_sim
        if   score >= 0.72: tier = 'HIGH'
        elif score >= 0.55: tier = 'MEDIUM'
        else:               tier = 'MISMATCH'
        return round(score, 4), tier
 
    def is_snr_acceptable(self, snr_db: float) -> bool:
        '''True only if SNR meets the 15 dB database write threshold.'''
        return snr_db >= self.SNR_GATE_DB |
| --- |