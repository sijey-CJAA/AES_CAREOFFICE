<?php

class CarsScoringEngine {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Calculates all scores and metadata for a single student's CARS responses.
     * @param array $responses Array of q1 to q24 values (can be null/empty)
     * @param string $grade_group e.g., 'Grades 4-8'
     * @return array Calculated data
     */
    public function evaluate($responses, $grade_group = 'Grades 4-8') {
        $result = [
            'q' => array_fill(1, 24, null),
            'externalizing_score' => null,
            'internalizing_score' => null,
            'social_score' => null,
            'academic_score' => null,
            'total_raw_score' => null,
            't_score' => null,
            'percentile_rank' => null,
            'risk_status' => 'INCOMPLETE',
            'tier_level' => 'Pending'
        ];

        $complete = true;
        
        // 1. Sanitize and validate inputs
        for ($i = 1; $i <= 24; $i++) {
            $key = "q{$i}";
            if (isset($responses[$key]) && $responses[$key] !== '') {
                $val = (int)$responses[$key];
                if ($val >= 0 && $val <= 4) {
                    $result['q'][$i] = $val;
                } else {
                    $complete = false; // invalid value means incomplete
                }
            } else {
                $complete = false;
            }
        }

        if (!$complete) {
            // Cannot process full evaluation, just return drafts
            return $result;
        }

        // 2. Calculate Subscales
        $result['externalizing_score'] = $this->sumItems($result['q'], [1, 5, 9, 13, 17, 21]);
        $result['internalizing_score'] = $this->sumItems($result['q'], [2, 6, 10, 14, 18, 22]);
        $result['social_score']        = $this->sumItems($result['q'], [3, 7, 11, 15, 19, 23]);
        $result['academic_score']      = $this->sumItems($result['q'], [4, 8, 12, 16, 20, 24]);

        // 3. Total Raw Score
        $result['total_raw_score'] = $result['externalizing_score'] + $result['internalizing_score'] + $result['social_score'] + $result['academic_score'];

        // 4. Norm Lookup
        $norm = $this->lookupNorm($result['total_raw_score'], $grade_group);
        
        if ($norm) {
            $result['t_score'] = $norm['t_score'];
            $result['percentile_rank'] = $norm['percentile'];
            
            // 5. Risk & MTSS Tier Assignment
            if ($result['t_score'] < 61) {
                $result['risk_status'] = 'NO-RISK';
                $result['tier_level'] = 'Tier 1';
            } elseif ($result['t_score'] >= 61 && $result['t_score'] <= 70) {
                $result['risk_status'] = 'AT-RISK';
                $result['tier_level'] = 'Tier 2';
            } else { // >= 71
                $result['risk_status'] = 'HIGH-RISK';
                $result['tier_level'] = 'Tier 3';
            }
        } else {
            // Missing norm data
            $result['risk_status'] = 'INCOMPLETE';
            $result['tier_level'] = 'Pending';
        }

        return $result;
    }

    private function sumItems($qArray, $indices) {
        $sum = 0;
        foreach ($indices as $i) {
            $sum += $qArray[$i];
        }
        return $sum;
    }

    private function lookupNorm($rawScore, $gradeGroup) {
        $stmt = $this->pdo->prepare("SELECT t_score, percentile FROM cars_norm_tables WHERE grade_group = ? AND raw_score = ? LIMIT 1");
        $stmt->execute([$gradeGroup, $rawScore]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
