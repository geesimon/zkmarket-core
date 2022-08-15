#!/bin/bash -e
mkdir -p build/circuits

# Compile circuit
circom circuits/commitment.circom --r1cs --wasm --output build/circuits
# circom circuits/withdraw.circom --r1cs --wasm --output build/circuits

cd build/circuits

# Download Power of Tau
PowerOfTauFile="powersOfTau28_hez_final_16.ptau"

if [ ! -f ${PowerOfTauFile} ]; then
    curl https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau > ${PowerOfTauFile}
fi


# Generate Phase 2 Key for commitment
npx snarkjs groth16 setup commitment.r1cs ${PowerOfTauFile} circuit_commitment_0000.zkey
echo "First Contribution"
printf '$(date +%s)\n' | npx snarkjs zkey contribute circuit_commitment_0000.zkey circuit_commitment_0001.zkey --name='First Contributor' -v
echo "Second Contribution"
printf '$(date +%s)\n' | npx snarkjs zkey contribute circuit_commitment_0001.zkey circuit_commitment_0002.zkey --name='Second Contributor' -v 
echo "Third Contribution"
npx snarkjs zkey export bellman circuit_commitment_0002.zkey  challenge_phase2_0003
printf '$(date +%s)\n' | npx snarkjs zkey bellman contribute bn128 challenge_phase2_0003 response_phase2_0003
npx snarkjs zkey import bellman circuit_commitment_0002.zkey response_phase2_0003 circuit_commitment_0003.zkey -n="Third contribution"

echo "Final Beacon for Phase2..."
npx snarkjs zkey beacon circuit_commitment_0003.zkey circuit_commitment_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 --name="Final Beacon phase2 for Commitment"

echo "Verify Key..."
npx snarkjs zkey verify commitment.r1cs ${PowerOfTauFile} circuit_commitment_final.zkey

npx snarkjs zkey export verificationkey circuit_commitment_final.zkey commitment_verification_key.json 

# # Generate Phase 2 Key for withdrawal
# npx snarkjs groth16 setup withdrawal.r1cs ${PowerOfTauFile} circuit_withdrawal_0000.zkey
# echo "First Contribution"
# printf '$(date +%s)\n' | npx snarkjs zkey contribute circuit_withdrawal_0000.zkey circuit_withdrawal_0001.zkey --name='First Contributor' -v
# echo "Second Contribution"
# printf '$(date +%s)\n' | npx snarkjs zkey contribute circuit_withdrawal_0001.zkey circuit_withdrawal_0002.zkey --name='Second Contributor' -v 

# echo "Third Contribution"
# npx snarkjs zkey export bellman circuit_withdrawal_0002.zkey  challenge_phase2_0003
# printf '$(date +%s)\n' | npx snarkjs zkey bellman contribute bn128 challenge_phase2_0003 response_phase2_0003
# npx snarkjs zkey import bellman circuit_withdrawal_0002.zkey response_phase2_0003 circuit_withdrawal_0003.zkey -n="Third contribution"

# echo "Final Beacon for Phase2"
# npx snarkjs zkey beacon circuit_withdrawal_0003.zkey circuit_withdrawal_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 --name="Final Beacon phase2 for Withdrawal"

# npx snarkjs zkey verify withdrawal.r1cs ${PowerOfTauFile} circuit_withdrawal_final.zkey

# npx snarkjs zkey export verificationkey circuit_withdrawal_final.zkey withdrawal_verification_key.json 

# Generate verificatoin smart contract
npx snarkjs zkey export solidityverifier circuit_commitment_final.zkey CommitmentVerifier.sol
# npx snarkjs zkey export solidityverifier circuit_withdrawal_final.zkey WithdrawalVerifier.sol


# Replace version
sed -i 's/0.6.11/0.8.0/g' CommitmentVerifier.sol
sed -i 's/contract Verifier/contract CommitmentVerifier/g' CommitmentVerifier.sol

# Copy outputs
# cp circuit_withdrawal_final.zkey ../../support
# cp withdraw_verification_key.json ../../support
# cp ./withdraw_js/withdraw.wasm ../../support
# cp Verifier.sol ../../contracts

# rm -f ../contracts/Verifier.json
# cd ../..

cp circuit_commitment_final.zkey ../../support
cp commitment_verification_key.json ../../support
cp ./commitment_js/commitment.wasm ../../support
cp CommitmentVerifier.sol ../../contracts

rm -f ../contracts/CommitmentVerifier.json
cd ../..
