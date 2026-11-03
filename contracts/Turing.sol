// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;



import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract Turing is ERC20 {
    mapping(string => address) public users;
    mapping(address => string) public addressOf;
    mapping(string => mapping(string => bool)) public hasVoted;
    // Quantos votos cada codinome já fez (para o bônus a cada 10 votos)
    mapping(string => uint256) public votesCount;

    address private owner;
    bool private voting = true;

    error NotAllowed(string message);
    error BadRequest(string message);

    constructor() ERC20("Turing", "TUR") {
        setUser("roberta", 0x502542668aF09fa7aea52174b9965A7799343Df7);
        setUser("nome1", 0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
        setUser("nome2", 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
        setUser("nome3", 0x90F79bf6EB2c4f870365E785982E1f101E93b906);
        setUser("nome4", 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65);
        setUser("nome5", 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc);
        setUser("nome6", 0x976EA74026E726554dB657fA54763abd0C3a0aa9);
        setUser("nome7", 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955);
        setUser("nome8", 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f);
        setUser("nome9", 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720);
        setUser("nome10", 0xBcd4042DE499D14e55001CcbB24a551F3b954096);
        setUser("nome11", 0x71bE63f3384f5fb98995898A86B02Fb2426c5788);
        setUser("nome12", 0xFABB0ac9d68B0B445fB7357272Ff202C5651694a);
        setUser("nome13", 0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec);
        setUser("nome14", 0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097);
        setUser("nome15", 0xcd3B766CCDd6AE721141F452C550Ca635964ce71);
        setUser("nome16", 0x2546BcD3c84621e976D8185a91A922aE77ECEc30);
        setUser("nome17", 0xbDA5747bFD65F08deb54cb465eB87D40e51B197E);
        setUser("nome18", 0xdD2FD4581271e230360230F9337D5c0430Bf44C0);
        setUser("nome19", 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199);

        owner = msg.sender;
    }

    modifier assertOwnerOrTeacher() {
        if (msg.sender != 0x502542668aF09fa7aea52174b9965A7799343Df7 && msg.sender != owner) {
            revert NotAllowed('You are not the owner or a teacher');
        }
        _;
    }

    modifier assertNameNotEmpty(string memory _name) {
        if (bytes(_name).length == 0) {
            revert BadRequest('Name cannot be empty');
        }
        _;
    }

    modifier assertUserExists(string memory _name) {
        if (users[_name] == address(0)) {
            revert BadRequest('User not found');
        }
        _;
    }

    modifier assertUserCanVote(address _address) {
        string memory name = addressOf[_address];
        if (Strings.equal(name, '')) {
            revert NotAllowed('You are not allowed to vote');
        }
        _;
    }

    function setUser(string memory _name, address _addr) private {
        users[_name] = _addr;
        addressOf[_addr] = _name;
    }

    function reward(string memory _name) private {
        uint256 count = votesCount[_name];
        count++;
        if (count == 10) {
            _mint(users[_name], 1);
            count = 0;
        }
        votesCount[_name] = count;
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function isVotingOn() public view returns (bool) {
        return voting;
    }

    function updateUser(string memory _name, address _addr) public assertOwnerOrTeacher() assertNameNotEmpty(_name) assertUserExists(_name) {
        delete addressOf[users[_name]];
        delete users[_name];

        setUser(_name, _addr);
    }

    function votingOn() public assertOwnerOrTeacher() {
        voting = true;
    }

    function votingOff() public assertOwnerOrTeacher() {
        voting = false;
    }

    function issueToken(string memory _name, uint256 _amount) public assertOwnerOrTeacher() assertUserExists(_name) {
        address to = users[_name];
        _mint(to, _amount);
    }

    function vote(string memory _name, uint256 _vote) public assertUserExists(_name) assertUserCanVote(msg.sender) {
        address callerAddress = msg.sender;
        string memory callerName = addressOf[callerAddress];

        if (Strings.equal(callerName, '')) {
            revert NotAllowed('You are not allowed to vote');
        }

        if (!voting) {
            revert BadRequest('Voting is not on');
        }

        if (_vote <= 0 || _vote > 2) {
            revert BadRequest('Invalid vote, must be between 0 and 2');
        }

        address votedAddress = users[_name];
        if (votedAddress == callerAddress) {
            revert BadRequest('You cannot vote for yourself');
        }

        if (hasVoted[callerName][_name]) {
            revert BadRequest('You have already voted');
        }
        hasVoted[callerName][_name] = true;
        _mint(votedAddress, _vote);
        // O bônus é de quem vota: 1 Turing a cada 10 votos feitos
        reward(callerName);
    }
}
